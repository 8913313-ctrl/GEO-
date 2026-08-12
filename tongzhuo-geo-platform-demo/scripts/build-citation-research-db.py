#!/usr/bin/env python3
"""Build the pinned GEO Citation Lab research SQLite database.

The builder intentionally accepts only GEO Citation Lab dataset 2.0.1 from
commit 81ba1566f70f114e9202b798f8d4525a9329ebd3.  Source binaries are never
trusted merely because they exist in the cache: a first build needs expected
SHA-256 values on the command line, and subsequent builds must agree with the
saved pin metadata.

The resulting database is an offline research baseline.  It is not customer
monitoring data and must not be used to claim current customer ranking,
mentions, recommendations, traffic, leads, or conversions.
"""

from __future__ import annotations

import argparse
import datetime as dt
import decimal
import hashlib
import json
import os
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Sequence


DATASET_VERSION = "2.0.1"
SOURCE_COMMIT = "81ba1566f70f114e9202b798f8d4525a9329ebd3"
RELEASE_DATE = "2026-07-14"
SOURCE_REPOSITORY = "https://github.com/yaojingang/geo-citation-lab"
RAW_BASE_URL = (
    "https://raw.githubusercontent.com/yaojingang/geo-citation-lab/"
    f"{SOURCE_COMMIT}/"
)
BUILDER_SCHEMA_VERSION = 1
EXPECTED_COUNTS = {
    "ai_platforms": 12,
    "questions": 620,
    "sources": 9_878,
    "pages": 107_659,
    "citation_observations": 214_119,
}


@dataclass(frozen=True)
class Artifact:
    name: str
    repository_path: str
    cache_path: str
    minimum_size: int
    expected_size: int


ARTIFACTS = (
    Artifact(
        "manifest",
        "03-cn-geo-citation-dataset/data/manifest.json",
        "data/manifest.json",
        16_000,
        24_362,
    ),
    Artifact(
        "duckdb",
        "03-cn-geo-citation-dataset/data/catalog/cn_geo.duckdb",
        "data/catalog/cn_geo.duckdb",
        40 * 1024 * 1024,
        42_741_760,
    ),
    Artifact(
        "parquet",
        (
            "03-cn-geo-citation-dataset/data/curated/"
            "citation_observations/release_date=2026-07-14/part-0001.parquet"
        ),
        (
            "data/curated/citation_observations/"
            "release_date=2026-07-14/part-0001.parquet"
        ),
        80 * 1024 * 1024,
        84_912_022,
    ),
)

DUCKDB_TABLES = (
    "ai_platforms",
    "questions",
    "question_labels",
    "sources",
    "pages",
    "source_visibility",
    "platform_overlap",
    "page_features",
    "content_performance",
    "data_quality",
    "data_dictionary",
    "responses",
)

TABLE_ORDER = {
    "ai_platforms": "platform_code",
    "questions": "question_id",
    "question_labels": "question_id, label_dimension, label_value",
    "sources": "source_id",
    "pages": "page_id",
    "source_visibility": "source_id, platform_code",
    "platform_overlap": "platform_a, platform_b",
    "page_features": "page_id",
    "content_performance": "page_id",
    "data_quality": "metric",
    "data_dictionary": "table_name",
    "responses": "response_id",
    "citation_observations": "citation_id",
}

LIMITATIONS = (
    (
        "COMPLETE_RESPONSES_UNAVAILABLE",
        "Complete model answers are unavailable in this fixed research package.",
    ),
    (
        "RESPONSE_ID_UNRELIABLE",
        "A reliable stable response_id is unavailable for reconstructing answers.",
    ),
    (
        "MODEL_VERSION_UNAVAILABLE",
        "Per-response model versions are unavailable.",
    ),
    (
        "COLLECTION_TIME_NOT_NORMALIZED",
        "Collection timestamps are not normalized into a comparable time series.",
    ),
    (
        "NOT_REAL_TIME_CUSTOMER_MONITORING",
        "The package is a historical research baseline, not customer monitoring.",
    ),
    (
        "NO_CUSTOMER_OUTCOME_ATTRIBUTION",
        "The package cannot attribute customer traffic, leads, conversions, or outcomes.",
    ),
)


class BuildError(RuntimeError):
    """A fail-closed validation or build error."""


def package_root() -> Path:
    project_root = Path(__file__).resolve().parents[1]
    return project_root / "research-packages" / "geo-citation-lab" / DATASET_VERSION


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while True:
            chunk = stream.read(chunk_size)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def validate_sha256(value: str | None, label: str) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if not re.fullmatch(r"[0-9a-f]{64}", normalized):
        raise BuildError(f"{label} must be exactly 64 hexadecimal characters")
    return normalized


def atomic_write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp-{os.getpid()}-{uuid.uuid4().hex}")
    try:
        with temporary.open("w", encoding="utf-8", newline="\n") as stream:
            json.dump(value, stream, ensure_ascii=False, sort_keys=True, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def load_pins(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise BuildError(f"Cannot read pin metadata {path}: {error}") from error
    if not isinstance(value, dict):
        raise BuildError(f"Pin metadata {path} must contain a JSON object")
    if value.get("schemaVersion") != 1:
        raise BuildError(f"Unsupported pin metadata schema in {path}")
    if value.get("datasetVersion") != DATASET_VERSION:
        raise BuildError(f"Pin metadata dataset version is not {DATASET_VERSION}")
    if value.get("sourceCommit") != SOURCE_COMMIT:
        raise BuildError(f"Pin metadata source commit is not {SOURCE_COMMIT}")
    if not isinstance(value.get("artifacts"), dict):
        raise BuildError(f"Pin metadata {path} has no artifacts object")
    return value


def artifact_candidates(root: Path, artifact: Artifact) -> Iterable[Path]:
    repository_path = Path(*artifact.repository_path.split("/"))
    cache_path = Path(*artifact.cache_path.split("/"))
    candidates = (
        root / repository_path,
        root / cache_path,
        root / Path(*artifact.cache_path.split("/")[1:]),
        root / "upstream" / cache_path,
    )
    seen: set[Path] = set()
    for candidate in candidates:
        normalized = candidate.resolve(strict=False)
        if normalized not in seen:
            seen.add(normalized)
            yield candidate


def resolve_local_artifact(root: Path, artifact: Artifact) -> Path:
    for candidate in artifact_candidates(root, artifact):
        if candidate.is_file():
            return candidate
    checked = ", ".join(str(item) for item in artifact_candidates(root, artifact))
    raise BuildError(f"Missing local {artifact.name}; checked: {checked}")


def download_artifact(artifact: Artifact, target: Path, expected_sha256: str) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(f".{target.stem}.download-part{target.suffix}")
    encoded_path = urllib.parse.quote(artifact.repository_path, safe="/")
    download_url = RAW_BASE_URL + encoded_path
    maximum_attempts = 6
    for attempt in range(1, maximum_attempts + 1):
        size = temporary.stat().st_size if temporary.is_file() else 0
        if size > artifact.expected_size:
            temporary.unlink(missing_ok=True)
            size = 0
        headers = {"User-Agent": "Tongzhuo-GEO-citation-research-builder/1"}
        if size:
            headers["Range"] = f"bytes={size}-"
        request = urllib.request.Request(download_url, headers=headers)
        try:
            response = urllib.request.urlopen(request, timeout=120)
            status = getattr(response, "status", response.getcode())
            if size and status != 206:
                response.close()
                temporary.unlink(missing_ok=True)
                size = 0
                request = urllib.request.Request(download_url, headers={"User-Agent": headers["User-Agent"]})
                response = urllib.request.urlopen(request, timeout=120)
            with response, temporary.open("ab" if size else "wb") as stream:
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    stream.write(chunk)
                    size += len(chunk)
                    if size > artifact.expected_size:
                        raise BuildError(f"Downloaded {artifact.name} exceeds the pinned size")
                stream.flush()
                os.fsync(stream.fileno())
            if size == artifact.expected_size:
                actual_sha256 = sha256_file(temporary)
                if actual_sha256 != expected_sha256:
                    temporary.unlink(missing_ok=True)
                    raise BuildError(
                        f"Downloaded {artifact.name} SHA-256 mismatch: "
                        f"expected {expected_sha256}, got {actual_sha256}"
                    )
                os.replace(temporary, target)
                return
        except BuildError:
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as error:
            if attempt == maximum_attempts:
                raise BuildError(
                    f"Cannot download {artifact.name} after {maximum_attempts} attempts; "
                    f"partial bytes retained for resume: {temporary.stat().st_size if temporary.is_file() else 0}; {error}"
                ) from error
        if attempt < maximum_attempts:
            time.sleep(min(2 ** (attempt - 1), 8))
    raise BuildError(
        f"Downloaded {artifact.name} is {temporary.stat().st_size if temporary.is_file() else 0} bytes; "
        f"expected exactly {artifact.expected_size}"
    )


def expected_source_hashes(args: argparse.Namespace) -> dict[str, str | None]:
    return {
        "manifest": validate_sha256(args.expected_manifest_sha256, "manifest SHA-256"),
        "duckdb": validate_sha256(args.expected_duckdb_sha256, "DuckDB SHA-256"),
        "parquet": validate_sha256(args.expected_parquet_sha256, "Parquet SHA-256"),
    }


def pinned_hash(pins: dict[str, Any] | None, artifact: Artifact) -> str | None:
    if pins is None:
        return None
    record = pins["artifacts"].get(artifact.name)
    if not isinstance(record, dict):
        raise BuildError(f"Pin metadata is missing artifact {artifact.name}")
    if record.get("repositoryPath") != artifact.repository_path:
        raise BuildError(f"Pinned path for {artifact.name} does not match this builder")
    return validate_sha256(record.get("sha256"), f"pinned {artifact.name} SHA-256")


def prepare_sources(
    args: argparse.Namespace,
    cache_dir: Path,
    pins: dict[str, Any] | None,
) -> tuple[dict[str, Path], dict[str, dict[str, Any]]]:
    supplied = expected_source_hashes(args)
    paths: dict[str, Path] = {}
    records: dict[str, dict[str, Any]] = {}

    for artifact in ARTIFACTS:
        pinned = pinned_hash(pins, artifact)
        cli_expected = supplied[artifact.name]
        if pinned and cli_expected and pinned != cli_expected:
            raise BuildError(
                f"CLI SHA-256 for {artifact.name} conflicts with saved pin metadata"
            )
        expected = pinned or cli_expected
        if expected is None:
            raise BuildError(
                f"No trusted SHA-256 is pinned for {artifact.name}. On the first build, "
                f"provide --expected-{artifact.name}-sha256 after independently "
                "verifying the immutable upstream artifact."
            )

        if args.upstream_root:
            path = resolve_local_artifact(args.upstream_root, artifact)
        else:
            path = cache_dir / Path(*artifact.cache_path.split("/"))
            if not path.is_file():
                if not args.download:
                    raise BuildError(
                        f"Cached {artifact.name} is missing at {path}. "
                        "Use --download or provide --upstream-root."
                    )
                download_artifact(artifact, path, expected)

        size = path.stat().st_size
        if size != artifact.expected_size:
            raise BuildError(
                f"{artifact.name} is {size} bytes; expected exactly {artifact.expected_size}"
            )
        actual = sha256_file(path)
        if actual != expected:
            raise BuildError(
                f"{artifact.name} SHA-256 mismatch: expected {expected}, got {actual}"
            )
        paths[artifact.name] = path
        records[artifact.name] = {
            "repositoryPath": artifact.repository_path,
            "sizeBytes": size,
            "minimumSizeBytes": artifact.minimum_size,
            "sha256": actual,
        }
    return paths, records


def validate_manifest(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise BuildError(f"Invalid upstream dataset manifest: {error}") from error
    if value.get("version") != DATASET_VERSION:
        raise BuildError(
            f"Upstream manifest version is {value.get('version')!r}, "
            f"expected {DATASET_VERSION!r}"
        )
    if value.get("release_date") != RELEASE_DATE:
        raise BuildError(
            f"Upstream manifest release_date is {value.get('release_date')!r}, "
            f"expected {RELEASE_DATE!r}"
        )
    summary = value.get("summary") or {}
    if int(summary.get("records", -1)) != EXPECTED_COUNTS["citation_observations"]:
        raise BuildError("Upstream manifest record count does not match dataset 2.0.1")
    return value


def import_duckdb() -> Any:
    try:
        import duckdb  # type: ignore
    except ImportError as error:
        raise BuildError(
            "Python package 'duckdb' is required. Install a reviewed, pinned version "
            "before running this builder."
        ) from error
    return duckdb


def q(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def sqlite_type(source_type: Any) -> str:
    value = str(source_type).upper()
    if "BOOL" in value or "INT" in value:
        return "INTEGER"
    if any(token in value for token in ("DOUBLE", "FLOAT", "REAL", "DECIMAL", "NUMERIC")):
        return "REAL"
    if any(token in value for token in ("BLOB", "BYTEA", "BINARY")):
        return "BLOB"
    return "TEXT"


def sqlite_value(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bytes)):
        return value
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (dt.date, dt.datetime, dt.time)):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        return float(value)
    if isinstance(value, memoryview):
        return value.tobytes()
    if isinstance(value, (list, tuple, dict)):
        return canonical_json(value)
    return str(value)


def source_table_names(connection: Any) -> set[str]:
    return {str(row[0]) for row in connection.execute("SHOW TABLES").fetchall()}


def validate_duckdb(connection: Any) -> dict[str, int]:
    names = source_table_names(connection)
    required = set(DUCKDB_TABLES) | {"warehouse_metadata"}
    missing = sorted(required - names)
    if missing:
        raise BuildError(f"Upstream DuckDB is missing tables: {', '.join(missing)}")
    metadata = connection.execute(
        "SELECT dataset_version, release_date FROM warehouse_metadata LIMIT 2"
    ).fetchall()
    if len(metadata) != 1:
        raise BuildError("warehouse_metadata must contain exactly one row")
    if str(metadata[0][0]) != DATASET_VERSION or str(metadata[0][1]) != RELEASE_DATE:
        raise BuildError("DuckDB warehouse metadata does not match the pinned dataset")
    counts: dict[str, int] = {}
    for table, expected in EXPECTED_COUNTS.items():
        if table == "citation_observations":
            continue
        actual = int(connection.execute(f"SELECT COUNT(*) FROM {q(table)}").fetchone()[0])
        if actual != expected:
            raise BuildError(f"{table} has {actual} rows; expected {expected}")
        counts[table] = actual
    response_count = int(connection.execute('SELECT COUNT(*) FROM "responses"').fetchone()[0])
    if response_count != 0:
        raise BuildError("Dataset 2.0.1 responses table is expected to be empty")
    counts["responses"] = response_count
    return counts


def validate_parquet(connection: Any, path: Path) -> tuple[list[str], int]:
    with path.open("rb") as stream:
        if stream.read(4) != b"PAR1":
            raise BuildError("Citation observations file has no Parquet header")
        stream.seek(-4, os.SEEK_END)
        if stream.read(4) != b"PAR1":
            raise BuildError("Citation observations file is incomplete (missing footer)")
    cursor = connection.execute("DESCRIBE SELECT * FROM read_parquet(?)", [str(path)])
    columns = [str(row[0]) for row in cursor.fetchall()]
    required = {
        "citation_id",
        "question_id",
        "platform_code",
        "page_id",
        "source_id",
        "canonical_url",
        "domain_normalized",
        "snippet",
        "release_date",
    }
    missing = sorted(required - set(columns))
    if missing:
        raise BuildError(f"Citation Parquet is missing columns: {', '.join(missing)}")
    count, minimum_release, maximum_release = connection.execute(
        "SELECT COUNT(*), MIN(release_date), MAX(release_date) FROM read_parquet(?)",
        [str(path)],
    ).fetchone()
    count = int(count)
    if count != EXPECTED_COUNTS["citation_observations"]:
        raise BuildError(
            f"citation_observations has {count} rows; "
            f"expected {EXPECTED_COUNTS['citation_observations']}"
        )
    if str(minimum_release) != RELEASE_DATE or str(maximum_release) != RELEASE_DATE:
        raise BuildError("Citation Parquet release_date does not match the pinned dataset")
    return columns, count


def create_sqlite_table(
    sqlite_connection: sqlite3.Connection,
    table: str,
    description: Sequence[Sequence[Any]],
) -> list[str]:
    columns = [str(item[0]) for item in description]
    definitions = ", ".join(
        f"{q(str(item[0]))} {sqlite_type(item[1])}" for item in description
    )
    sqlite_connection.execute(f"CREATE TABLE {q(table)} ({definitions})")
    return columns


def copy_query(
    duck_connection: Any,
    sqlite_connection: sqlite3.Connection,
    table: str,
    query: str,
    parameters: Sequence[Any],
    chunk_size: int,
) -> tuple[int, list[str]]:
    cursor = duck_connection.execute(query, list(parameters))
    columns = create_sqlite_table(sqlite_connection, table, cursor.description)
    placeholders = ",".join("?" for _ in columns)
    insert_sql = f"INSERT INTO {q(table)} VALUES ({placeholders})"
    count = 0
    while True:
        rows = cursor.fetchmany(chunk_size)
        if not rows:
            break
        normalized = [tuple(sqlite_value(value) for value in row) for row in rows]
        sqlite_connection.executemany(insert_sql, normalized)
        count += len(normalized)
    return count, columns


def create_index_if_columns(
    connection: sqlite3.Connection,
    table: str,
    index_name: str,
    columns: Sequence[str],
) -> None:
    available = {
        str(row[1]) for row in connection.execute(f"PRAGMA table_info({q(table)})").fetchall()
    }
    if set(columns).issubset(available):
        column_sql = ", ".join(q(column) for column in columns)
        connection.execute(f"CREATE INDEX {q(index_name)} ON {q(table)} ({column_sql})")


def create_indexes(connection: sqlite3.Connection) -> None:
    specifications = (
        ("questions", "idx_questions_layer", ("source_layer", "source_subcat")),
        ("question_labels", "idx_question_labels_value", ("label_dimension", "label_value")),
        ("sources", "idx_sources_domain", ("domain",)),
        ("sources", "idx_sources_category", ("source_category_l1", "source_type")),
        ("pages", "idx_pages_source", ("source_id",)),
        ("source_visibility", "idx_source_visibility_platform", ("platform_code",)),
        ("source_visibility", "idx_source_visibility_source", ("source_id",)),
        ("platform_overlap", "idx_platform_overlap_pair", ("platform_a", "platform_b")),
        ("content_performance", "idx_content_performance_source", ("source_id",)),
        ("citation_observations", "idx_citations_question", ("question_id",)),
        ("citation_observations", "idx_citations_platform", ("platform_code",)),
        ("citation_observations", "idx_citations_source", ("source_id",)),
        ("citation_observations", "idx_citations_page", ("page_id",)),
        ("citation_observations", "idx_citations_domain", ("domain_normalized",)),
    )
    for table, name, columns in specifications:
        create_index_if_columns(connection, table, name, columns)


def create_research_views(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        CREATE VIEW research_platform_summary AS
        SELECT
          p.platform_code,
          p.platform_name_cn,
          p.product_family,
          p.terminal,
          p.company_ecosystem,
          p.citation_record_count,
          p.question_count,
          COUNT(DISTINCT v.source_id) AS source_count,
          COALESCE(SUM(v.page_count), 0) AS platform_source_page_count
        FROM ai_platforms AS p
        LEFT JOIN source_visibility AS v ON v.platform_code = p.platform_code
        GROUP BY p.platform_code, p.platform_name_cn, p.product_family, p.terminal,
                 p.company_ecosystem, p.citation_record_count, p.question_count;

        CREATE VIEW research_source_type_summary AS
        SELECT
          source_category_l1,
          source_category_l1_cn,
          source_type,
          source_type_cn,
          COUNT(*) AS source_count,
          SUM(citation_record_count) AS citation_record_count,
          SUM(unique_citation_count) AS unique_citation_count,
          SUM(page_count) AS page_count
        FROM sources
        GROUP BY source_category_l1, source_category_l1_cn, source_type, source_type_cn;

        CREATE VIEW research_question_label_summary AS
        SELECT
          l.label_dimension,
          l.label_value,
          l.label_cn,
          COUNT(DISTINCT l.question_id) AS question_count,
          SUM(qs.citation_record_count) AS citation_record_count,
          AVG(qs.platform_count) AS average_platform_count,
          AVG(qs.source_count) AS average_source_count
        FROM question_labels AS l
        JOIN questions AS qs ON qs.question_id = l.question_id
        GROUP BY l.label_dimension, l.label_value, l.label_cn;

        CREATE VIEW research_content_pattern_summary AS
        SELECT
          f.content_format_hint,
          COUNT(*) AS page_count,
          SUM(p.deduplicated_citation_count) AS deduplicated_citation_count,
          AVG(p.question_count) AS average_question_count,
          AVG(p.platform_count) AS average_platform_count,
          AVG(p.average_quote_position) AS average_quote_position
        FROM page_features AS f
        JOIN content_performance AS p ON p.page_id = f.page_id
        GROUP BY f.content_format_hint;
        """
    )


def insert_metadata(
    connection: sqlite3.Connection,
    source_records: dict[str, dict[str, Any]],
    row_counts: dict[str, int],
) -> None:
    connection.execute(
        "CREATE TABLE metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)"
    )
    values = {
        "schema_version": str(BUILDER_SCHEMA_VERSION),
        "dataset_version": DATASET_VERSION,
        "source_commit": SOURCE_COMMIT,
        "release_date": RELEASE_DATE,
        "source_repository": SOURCE_REPOSITORY,
        # Do not write the wall-clock build time into SQLite.  Keeping the
        # database content deterministic makes its derived SHA-256 reusable
        # across a forced rebuild with identical inputs.  The external pin
        # document records the operational build time instead.
        "deterministic_build": "true",
        "evidence_scope": "historical_research_baseline",
        "real_time_customer_monitoring": "false",
        "complete_responses_available": "false",
        "attribution": (
            "GEO Citation Lab contributors, GEO Citation Lab, "
            "https://github.com/yaojingang/geo-citation-lab, CC BY 4.0"
        ),
        "source_artifacts_json": canonical_json(source_records),
        "row_counts_json": canonical_json(row_counts),
    }
    connection.executemany(
        "INSERT INTO metadata(key, value) VALUES (?, ?)", sorted(values.items())
    )
    connection.execute(
        """
        CREATE TABLE source_artifacts (
          artifact_name TEXT PRIMARY KEY NOT NULL,
          repository_path TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          minimum_size_bytes INTEGER NOT NULL,
          sha256 TEXT NOT NULL
        )
        """
    )
    connection.executemany(
        "INSERT INTO source_artifacts VALUES (?, ?, ?, ?, ?)",
        [
            (
                name,
                record["repositoryPath"],
                record["sizeBytes"],
                record["minimumSizeBytes"],
                record["sha256"],
            )
            for name, record in sorted(source_records.items())
        ],
    )
    connection.execute(
        """
        CREATE TABLE table_inventory (
          table_name TEXT PRIMARY KEY NOT NULL,
          row_count INTEGER NOT NULL,
          source_artifact TEXT NOT NULL
        )
        """
    )
    connection.executemany(
        "INSERT INTO table_inventory VALUES (?, ?, ?)",
        [
            (
                table,
                count,
                "parquet" if table == "citation_observations" else "duckdb",
            )
            for table, count in sorted(row_counts.items())
        ],
    )
    connection.execute(
        """
        CREATE TABLE research_limitations (
          code TEXT PRIMARY KEY NOT NULL,
          description TEXT NOT NULL
        )
        """
    )
    connection.executemany("INSERT INTO research_limitations VALUES (?, ?)", LIMITATIONS)


def build_sqlite(
    output: Path,
    paths: dict[str, Path],
    source_records: dict[str, dict[str, Any]],
    chunk_size: int,
) -> dict[str, int]:
    duckdb = import_duckdb()
    duck_connection = duckdb.connect(str(paths["duckdb"]), read_only=True)
    try:
        row_counts = validate_duckdb(duck_connection)
        _, citation_count = validate_parquet(duck_connection, paths["parquet"])
        row_counts["citation_observations"] = citation_count
        sqlite_connection = sqlite3.connect(str(output))
        try:
            sqlite_connection.execute("PRAGMA page_size = 4096")
            sqlite_connection.execute("PRAGMA journal_mode = DELETE")
            sqlite_connection.execute("PRAGMA synchronous = FULL")
            sqlite_connection.execute("PRAGMA temp_store = FILE")
            sqlite_connection.execute("PRAGMA foreign_keys = ON")
            sqlite_connection.execute("BEGIN IMMEDIATE")

            actual_counts: dict[str, int] = {}
            for table in DUCKDB_TABLES:
                order = TABLE_ORDER[table]
                count, _ = copy_query(
                    duck_connection,
                    sqlite_connection,
                    table,
                    f"SELECT * FROM {q(table)} ORDER BY {order}",
                    (),
                    chunk_size,
                )
                actual_counts[table] = count

            count, _ = copy_query(
                duck_connection,
                sqlite_connection,
                "citation_observations",
                "SELECT * FROM read_parquet(?) ORDER BY citation_id",
                (str(paths["parquet"]),),
                chunk_size,
            )
            actual_counts["citation_observations"] = count
            for table, expected in row_counts.items():
                if actual_counts.get(table) != expected:
                    raise BuildError(
                        f"Copied row count for {table} is {actual_counts.get(table)}; "
                        f"expected {expected}"
                    )

            create_indexes(sqlite_connection)
            create_research_views(sqlite_connection)
            insert_metadata(sqlite_connection, source_records, actual_counts)
            sqlite_connection.execute(f"PRAGMA user_version = {BUILDER_SCHEMA_VERSION}")
            sqlite_connection.commit()
            sqlite_connection.execute("ANALYZE")
            sqlite_connection.commit()
            integrity = sqlite_connection.execute("PRAGMA integrity_check").fetchone()[0]
            if integrity != "ok":
                raise BuildError(f"SQLite integrity_check failed: {integrity}")
        except Exception:
            sqlite_connection.rollback()
            raise
        finally:
            sqlite_connection.close()
    finally:
        duck_connection.close()
    # SQLite ran with synchronous=FULL and has already flushed the committed
    # database.  A second Python fsync is useful on POSIX, but can raise
    # EBADF on some Windows filesystem/filter-driver combinations even after
    # sqlite3 has closed the file successfully.
    if os.name != "nt":
        with output.open("r+b") as stream:
            stream.flush()
            os.fsync(stream.fileno())
    return actual_counts


def read_output_fingerprint(path: Path) -> dict[str, str] | None:
    if not path.is_file():
        return None
    try:
        connection = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
        try:
            integrity = connection.execute("PRAGMA quick_check").fetchone()[0]
            if integrity != "ok":
                return None
            return {
                str(key): str(value)
                for key, value in connection.execute("SELECT key, value FROM metadata")
            }
        finally:
            connection.close()
    except sqlite3.Error:
        return None


def output_is_current(
    output: Path,
    source_records: dict[str, dict[str, Any]],
) -> bool:
    metadata = read_output_fingerprint(output)
    if metadata is None:
        return False
    return (
        metadata.get("schema_version") == str(BUILDER_SCHEMA_VERSION)
        and metadata.get("dataset_version") == DATASET_VERSION
        and metadata.get("source_commit") == SOURCE_COMMIT
        and metadata.get("source_artifacts_json") == canonical_json(source_records)
    )


def verify_output_pin(
    actual_hash: str,
    pins: dict[str, Any] | None,
    expected_cli: str | None,
    allow_repin: bool,
) -> None:
    pinned: str | None = None
    if pins and isinstance(pins.get("derived"), dict):
        pinned = validate_sha256(pins["derived"].get("sha256"), "pinned output SHA-256")
    if pinned and expected_cli and pinned != expected_cli and not allow_repin:
        raise BuildError("CLI output SHA-256 conflicts with saved derived pin")
    expected = expected_cli or pinned
    if expected and actual_hash != expected:
        raise BuildError(
            f"Derived SQLite SHA-256 mismatch: expected {expected}, got {actual_hash}"
        )


def make_pin_document(
    source_records: dict[str, dict[str, Any]],
    output: Path,
    output_hash: str,
    built_at: str,
) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "datasetVersion": DATASET_VERSION,
        "sourceCommit": SOURCE_COMMIT,
        "sourceRepository": SOURCE_REPOSITORY,
        "artifacts": source_records,
        "derived": {
            "relativeName": "derived/citation-research.sqlite",
            "schemaVersion": BUILDER_SCHEMA_VERSION,
            "sizeBytes": output.stat().st_size,
            "sha256": output_hash,
            "builtAt": built_at,
        },
    }


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    root = package_root()
    parser = argparse.ArgumentParser(
        description=(
            "Build a verified SQLite research database from pinned GEO Citation Lab "
            "2.0.1 DuckDB and citation-observation Parquet artifacts."
        )
    )
    parser.add_argument(
        "--upstream-root",
        type=Path,
        help="Local repository, dataset, data, or prepared upstream root.",
    )
    parser.add_argument(
        "--cache-dir",
        type=Path,
        default=root / "upstream",
        help="Download/read cache directory (default: package upstream directory).",
    )
    parser.add_argument(
        "--pin-file",
        type=Path,
        help="Pin metadata path (default: CACHE_DIR/.citation-research-pins.json).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=root / "derived" / "citation-research.sqlite",
        help="Destination SQLite path.",
    )
    parser.add_argument(
        "--download",
        action="store_true",
        help="Download missing cache artifacts from the immutable commit URL.",
    )
    parser.add_argument("--expected-manifest-sha256")
    parser.add_argument("--expected-duckdb-sha256")
    parser.add_argument("--expected-parquet-sha256")
    parser.add_argument(
        "--expected-output-sha256",
        help="Optional independently computed SHA-256 for the derived SQLite file.",
    )
    parser.add_argument(
        "--repin-output",
        action="store_true",
        help="Allow replacing a previous derived pin; requires --expected-output-sha256.",
    )
    parser.add_argument("--force", action="store_true", help="Rebuild even when current.")
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Validate pinned sources and schemas without writing output or pin metadata.",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=5_000,
        help="Rows copied per batch (default: 5000).",
    )
    args = parser.parse_args(argv)
    args.cache_dir = args.cache_dir.resolve()
    args.output = args.output.resolve()
    args.upstream_root = args.upstream_root.resolve() if args.upstream_root else None
    args.pin_file = (
        args.pin_file.resolve()
        if args.pin_file
        else args.cache_dir / ".citation-research-pins.json"
    )
    args.expected_output_sha256 = validate_sha256(
        args.expected_output_sha256, "output SHA-256"
    )
    if args.chunk_size < 100 or args.chunk_size > 100_000:
        parser.error("--chunk-size must be between 100 and 100000")
    if args.repin_output and not args.expected_output_sha256:
        parser.error("--repin-output requires --expected-output-sha256")
    if args.upstream_root and args.download:
        parser.error("--download cannot be combined with --upstream-root")
    return args


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    pins = load_pins(args.pin_file)
    paths, source_records = prepare_sources(args, args.cache_dir, pins)
    validate_manifest(paths["manifest"])

    duckdb = import_duckdb()
    connection = duckdb.connect(str(paths["duckdb"]), read_only=True)
    try:
        row_counts = validate_duckdb(connection)
        _, citation_count = validate_parquet(connection, paths["parquet"])
        row_counts["citation_observations"] = citation_count
    finally:
        connection.close()

    if args.verify_only:
        print(
            json.dumps(
                {
                    "status": "verified",
                    "datasetVersion": DATASET_VERSION,
                    "sourceCommit": SOURCE_COMMIT,
                    "artifacts": source_records,
                    "rowCounts": row_counts,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0

    if output_is_current(args.output, source_records) and not args.force:
        output_hash = sha256_file(args.output)
        verify_output_pin(
            output_hash,
            pins,
            args.expected_output_sha256,
            args.repin_output,
        )
        document = make_pin_document(
            source_records,
            args.output,
            output_hash,
            (
                pins.get("derived", {}).get("builtAt")
                if pins and isinstance(pins.get("derived"), dict)
                else utc_now()
            ),
        )
        atomic_write_json(args.pin_file, document)
        print(
            canonical_json(
                {
                    "status": "up_to_date",
                    "output": str(args.output),
                    "sha256": output_hash,
                }
            )
        )
        return 0

    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_name(
        f".{args.output.name}.tmp-{os.getpid()}-{uuid.uuid4().hex}"
    )
    temporary.unlink(missing_ok=True)
    try:
        copied_counts = build_sqlite(
            temporary,
            paths,
            source_records,
            args.chunk_size,
        )
        built_at = utc_now()
        output_hash = sha256_file(temporary)
        verify_output_pin(
            output_hash,
            pins,
            args.expected_output_sha256,
            args.repin_output,
        )
        os.replace(temporary, args.output)
        document = make_pin_document(
            source_records, args.output, output_hash, built_at
        )
        atomic_write_json(args.pin_file, document)
    finally:
        temporary.unlink(missing_ok=True)

    print(
        json.dumps(
            {
                "status": "built",
                "datasetVersion": DATASET_VERSION,
                "sourceCommit": SOURCE_COMMIT,
                "output": str(args.output),
                "sizeBytes": args.output.stat().st_size,
                "sha256": output_hash,
                "rowCounts": copied_counts,
                "pinFile": str(args.pin_file),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except BuildError as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(2)

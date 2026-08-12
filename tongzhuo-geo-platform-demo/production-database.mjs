import { chmodSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const moduleRoot = path.dirname(fileURLToPath(import.meta.url));

const MIGRATIONS = Object.freeze([
  {
    version: 1,
    name: "production_foundation",
    sql: `
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        username_normalized TEXT NOT NULL COLLATE NOCASE UNIQUE,
        display_name TEXT NOT NULL,
        email TEXT,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'reviewer', 'viewer')),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_login_at TEXT
      ) STRICT;

      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        csrf_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        revoked_at TEXT,
        ip_address TEXT,
        user_agent TEXT
      ) STRICT;

      CREATE INDEX sessions_user_active_idx
        ON sessions (user_id, revoked_at, expires_at);

      CREATE TABLE workspace_state (
        workspace_id TEXT PRIMARY KEY,
        revision INTEGER NOT NULL CHECK (revision >= 1),
        state_json TEXT NOT NULL CHECK (json_valid(state_json)),
        checksum TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
      ) STRICT;

      CREATE TABLE workspace_revisions (
        workspace_id TEXT NOT NULL REFERENCES workspace_state(workspace_id) ON DELETE CASCADE,
        revision INTEGER NOT NULL CHECK (revision >= 1),
        state_json TEXT NOT NULL CHECK (json_valid(state_json)),
        checksum TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        PRIMARY KEY (workspace_id, revision)
      ) STRICT;

      CREATE TABLE business_records (
        workspace_id TEXT NOT NULL REFERENCES workspace_state(workspace_id) ON DELETE CASCADE,
        record_type TEXT NOT NULL,
        record_id TEXT NOT NULL,
        business_line_id TEXT,
        status TEXT,
        display_name TEXT,
        ordinal INTEGER NOT NULL DEFAULT 0,
        payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
        workspace_revision INTEGER NOT NULL CHECK (workspace_revision >= 1),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (workspace_id, record_type, record_id)
      ) STRICT;

      CREATE INDEX business_records_type_idx
        ON business_records (workspace_id, record_type, ordinal);
      CREATE INDEX business_records_line_idx
        ON business_records (workspace_id, business_line_id, record_type);

      CREATE TABLE audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);
      CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_user_id, created_at DESC);
      CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id, created_at DESC);
    `
  },
  {
    version: 2,
    name: "knowledge_rag_foundation",
    sql: `
      CREATE TABLE knowledge_libraries (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        business_line_id TEXT,
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('document', 'qa')),
        scope TEXT NOT NULL DEFAULT 'business_line' CHECK (scope IN ('enterprise', 'business_line')),
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE (workspace_id, name)
      ) STRICT;

      CREATE INDEX knowledge_libraries_line_idx
        ON knowledge_libraries (workspace_id, business_line_id, status);

      CREATE TABLE knowledge_documents (
        id TEXT PRIMARY KEY,
        library_id TEXT NOT NULL REFERENCES knowledge_libraries(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        source_type TEXT NOT NULL CHECK (source_type IN ('text', 'file', 'url', 'qa')),
        source_name TEXT NOT NULL DEFAULT '',
        source_url TEXT NOT NULL DEFAULT '',
        mime_type TEXT NOT NULL DEFAULT 'text/plain',
        content_hash TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL
      ) STRICT;

      CREATE INDEX knowledge_documents_library_idx
        ON knowledge_documents (library_id, status, updated_at DESC);
      CREATE INDEX knowledge_documents_hash_idx
        ON knowledge_documents (library_id, content_hash);

      CREATE TABLE knowledge_document_versions (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
        version INTEGER NOT NULL CHECK (version >= 1),
        content_text TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
        review_status TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'pending', 'approved', 'rejected', 'archived')),
        index_status TEXT NOT NULL DEFAULT 'not_indexed' CHECK (index_status IN ('not_indexed', 'queued', 'indexing', 'indexed', 'failed')),
        approved_at TEXT,
        approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        indexed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE (document_id, version)
      ) STRICT;

      CREATE INDEX knowledge_versions_review_idx
        ON knowledge_document_versions (document_id, review_status, index_status);

      CREATE TABLE knowledge_chunks (
        id TEXT PRIMARY KEY,
        version_id TEXT NOT NULL REFERENCES knowledge_document_versions(id) ON DELETE CASCADE,
        ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
        heading TEXT NOT NULL DEFAULT '',
        content_text TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        locator TEXT NOT NULL DEFAULT '',
        token_count INTEGER NOT NULL DEFAULT 0,
        embedding_json TEXT,
        embedding_model TEXT,
        embedding_provider_id TEXT,
        embedding_status TEXT NOT NULL DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'ready', 'failed')),
        metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
        created_at TEXT NOT NULL,
        UNIQUE (version_id, ordinal)
      ) STRICT;

      CREATE INDEX knowledge_chunks_version_idx
        ON knowledge_chunks (version_id, ordinal);
      CREATE INDEX knowledge_chunks_hash_idx
        ON knowledge_chunks (content_hash);
      CREATE INDEX knowledge_chunks_embedding_idx
        ON knowledge_chunks (embedding_status, embedding_model);

      CREATE TABLE knowledge_index_jobs (
        id TEXT PRIMARY KEY,
        version_id TEXT NOT NULL REFERENCES knowledge_document_versions(id) ON DELETE CASCADE,
        job_type TEXT NOT NULL CHECK (job_type IN ('index', 'reindex', 'delete')),
        status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
        attempts INTEGER NOT NULL DEFAULT 0,
        error_code TEXT,
        error_message TEXT,
        stats_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(stats_json)),
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL
      ) STRICT;

      CREATE INDEX knowledge_index_jobs_status_idx
        ON knowledge_index_jobs (status, created_at);

      CREATE TABLE knowledge_retrieval_runs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        business_line_id TEXT,
        query_text TEXT NOT NULL,
        filters_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(filters_json)),
        result_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(result_json)),
        embedding_model TEXT,
        retrieval_mode TEXT NOT NULL DEFAULT 'hybrid',
        created_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL
      ) STRICT;

      CREATE INDEX knowledge_retrieval_runs_workspace_idx
        ON knowledge_retrieval_runs (workspace_id, created_at DESC);
    `
  },
  {
    version: 3,
    name: "content_production_foundation",
    sql: `
      CREATE TABLE content_plans (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        business_line_id TEXT,
        name TEXT NOT NULL,
        content_type TEXT NOT NULL DEFAULT '',
        owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'planned', 'active', 'completed', 'cancelled', 'archived')),
        scheduled_for TEXT,
        revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
        metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL
      ) STRICT;

      CREATE INDEX content_plans_workspace_idx
        ON content_plans (workspace_id, status, updated_at DESC);
      CREATE INDEX content_plans_line_idx
        ON content_plans (workspace_id, business_line_id, status);

      CREATE TABLE content_tasks (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        plan_id TEXT REFERENCES content_plans(id) ON DELETE SET NULL,
        topic_id TEXT,
        business_line_id TEXT,
        title TEXT NOT NULL,
        assignee_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        article_id TEXT,
        status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'queued', 'generating', 'draft', 'in_review', 'changes_requested', 'approved', 'completed', 'cancelled')),
        due_at TEXT,
        revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
        metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL
      ) STRICT;

      CREATE INDEX content_tasks_workspace_idx
        ON content_tasks (workspace_id, status, updated_at DESC);
      CREATE INDEX content_tasks_plan_idx
        ON content_tasks (workspace_id, plan_id, status);

      CREATE TABLE content_articles (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        task_id TEXT REFERENCES content_tasks(id) ON DELETE SET NULL,
        plan_id TEXT REFERENCES content_plans(id) ON DELETE SET NULL,
        topic_id TEXT,
        business_line_id TEXT,
        title TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'changes_requested', 'approved', 'published', 'archived')),
        current_version_id TEXT,
        approved_version_id TEXT,
        revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
        metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
      ) STRICT;

      CREATE INDEX content_articles_workspace_idx
        ON content_articles (workspace_id, status, updated_at DESC);
      CREATE INDEX content_articles_plan_idx
        ON content_articles (workspace_id, plan_id, status);
      CREATE INDEX content_articles_line_idx
        ON content_articles (workspace_id, business_line_id, status);

      CREATE TABLE content_generation_jobs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        article_id TEXT REFERENCES content_articles(id) ON DELETE SET NULL,
        task_id TEXT REFERENCES content_tasks(id) ON DELETE SET NULL,
        operation TEXT NOT NULL DEFAULT 'article' CHECK (operation IN ('article', 'rewrite', 'collaboration')),
        status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
        idempotency_key TEXT,
        provider_id TEXT,
        model TEXT,
        prompt_version TEXT,
        retrieval_run_id TEXT,
        request_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(request_json)),
        result_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(result_json)),
        input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
        output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
        cost_micros INTEGER NOT NULL DEFAULT 0 CHECK (cost_micros >= 0),
        attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        error_code TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE (workspace_id, idempotency_key)
      ) STRICT;

      CREATE INDEX content_generation_jobs_status_idx
        ON content_generation_jobs (workspace_id, status, created_at);
      CREATE INDEX content_generation_jobs_article_idx
        ON content_generation_jobs (article_id, created_at DESC);

      CREATE TABLE content_article_versions (
        id TEXT PRIMARY KEY,
        article_id TEXT NOT NULL REFERENCES content_articles(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL CHECK (version_number >= 1),
        based_on_version_id TEXT REFERENCES content_article_versions(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        content_html TEXT NOT NULL DEFAULT '',
        content_text TEXT NOT NULL,
        excerpt TEXT NOT NULL DEFAULT '',
        content_hash TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'human' CHECK (source IN ('human', 'ai', 'import')),
        generation_job_id TEXT REFERENCES content_generation_jobs(id) ON DELETE SET NULL,
        review_status TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'pending', 'changes_requested', 'approved', 'superseded')),
        risk_status TEXT NOT NULL DEFAULT 'not_scanned' CHECK (risk_status IN ('not_scanned', 'passed', 'warning', 'blocked', 'failed')),
        metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
        frozen_at TEXT,
        frozen_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE (article_id, version_number)
      ) STRICT;

      CREATE INDEX content_article_versions_article_idx
        ON content_article_versions (article_id, version_number DESC);
      CREATE INDEX content_article_versions_gate_idx
        ON content_article_versions (article_id, review_status, risk_status, frozen_at);

      CREATE TRIGGER content_article_version_body_immutable
      BEFORE UPDATE OF article_id, version_number, based_on_version_id, title, content_html, content_text, excerpt, content_hash, source, generation_job_id, metadata_json, created_at, created_by
      ON content_article_versions
      BEGIN
        SELECT RAISE(ABORT, 'CONTENT_VERSION_IMMUTABLE');
      END;

      CREATE TRIGGER content_article_version_delete_immutable
      BEFORE DELETE ON content_article_versions
      BEGIN
        SELECT RAISE(ABORT, 'CONTENT_VERSION_IMMUTABLE');
      END;

      CREATE TABLE content_article_evidence (
        id TEXT PRIMARY KEY,
        article_version_id TEXT NOT NULL REFERENCES content_article_versions(id) ON DELETE CASCADE,
        ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
        marker TEXT NOT NULL,
        knowledge_library_id TEXT,
        knowledge_document_id TEXT,
        knowledge_version_id TEXT,
        knowledge_chunk_id TEXT,
        claim TEXT NOT NULL DEFAULT '',
        quote TEXT NOT NULL DEFAULT '',
        support_status TEXT NOT NULL DEFAULT 'supported' CHECK (support_status IN ('supported', 'partial', 'unsupported', 'conflict')),
        metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
        created_at TEXT NOT NULL,
        UNIQUE (article_version_id, marker),
        UNIQUE (article_version_id, ordinal)
      ) STRICT;

      CREATE INDEX content_article_evidence_version_idx
        ON content_article_evidence (article_version_id, ordinal);
      CREATE INDEX content_article_evidence_chunk_idx
        ON content_article_evidence (knowledge_chunk_id);

      CREATE TABLE content_article_reviews (
        id TEXT PRIMARY KEY,
        article_version_id TEXT NOT NULL REFERENCES content_article_versions(id) ON DELETE CASCADE,
        review_round INTEGER NOT NULL CHECK (review_round >= 1),
        action TEXT NOT NULL CHECK (action IN ('submitted', 'changes_requested', 'approved', 'commented')),
        from_status TEXT,
        to_status TEXT,
        note TEXT NOT NULL DEFAULT '',
        details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
        created_at TEXT NOT NULL,
        actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
      ) STRICT;

      CREATE INDEX content_article_reviews_version_idx
        ON content_article_reviews (article_version_id, created_at);

      CREATE TABLE content_risk_scan_runs (
        id TEXT PRIMARY KEY,
        article_version_id TEXT NOT NULL REFERENCES content_article_versions(id) ON DELETE CASCADE,
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'passed', 'warning', 'blocked', 'failed')),
        policy_version TEXT NOT NULL DEFAULT '',
        findings_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(findings_json)),
        summary_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(summary_json)),
        error_code TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL
      ) STRICT;

      CREATE INDEX content_risk_scan_runs_version_idx
        ON content_risk_scan_runs (article_version_id, created_at DESC);
      CREATE INDEX content_risk_scan_runs_status_idx
        ON content_risk_scan_runs (status, created_at);
    `
  },
  {
    version: 4,
    name: "knowledge_enterprise_capabilities",
    sql: `
      ALTER TABLE knowledge_document_versions ADD COLUMN extraction_status TEXT NOT NULL DEFAULT 'complete';
      ALTER TABLE knowledge_document_versions ADD COLUMN extraction_method TEXT NOT NULL DEFAULT 'text';
      ALTER TABLE knowledge_index_jobs ADD COLUMN next_attempt_at TEXT;
      ALTER TABLE knowledge_index_jobs ADD COLUMN locked_at TEXT;
      ALTER TABLE knowledge_index_jobs ADD COLUMN locked_by TEXT;
      ALTER TABLE knowledge_index_jobs ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3;

      CREATE TABLE knowledge_assets (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        library_id TEXT REFERENCES knowledge_libraries(id) ON DELETE CASCADE,
        document_id TEXT REFERENCES knowledge_documents(id) ON DELETE CASCADE,
        version_id TEXT REFERENCES knowledge_document_versions(id) ON DELETE CASCADE,
        asset_type TEXT NOT NULL CHECK (asset_type IN ('image', 'table', 'file', 'attachment')),
        source_name TEXT NOT NULL DEFAULT '',
        mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
        content_hash TEXT NOT NULL,
        data_base64 TEXT NOT NULL DEFAULT '',
        extracted_text TEXT NOT NULL DEFAULT '',
        alt_text TEXT NOT NULL DEFAULT '',
        ocr_status TEXT NOT NULL DEFAULT 'not_required' CHECK (ocr_status IN ('not_required', 'queued', 'processing', 'succeeded', 'failed')),
        review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected', 'archived')),
        metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL
      ) STRICT;

      CREATE INDEX knowledge_assets_scope_idx
        ON knowledge_assets (workspace_id, library_id, document_id, version_id, review_status);
      CREATE INDEX knowledge_assets_hash_idx
        ON knowledge_assets (content_hash);

      CREATE TABLE knowledge_ocr_jobs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        version_id TEXT REFERENCES knowledge_document_versions(id) ON DELETE CASCADE,
        asset_id TEXT REFERENCES knowledge_assets(id) ON DELETE CASCADE,
        provider TEXT NOT NULL DEFAULT 'configured',
        status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'succeeded', 'failed', 'cancelled')),
        attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts >= 1),
        input_hash TEXT NOT NULL,
        result_text TEXT NOT NULL DEFAULT '',
        result_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(result_json)),
        error_code TEXT,
        error_message TEXT,
        next_attempt_at TEXT,
        locked_at TEXT,
        locked_by TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL
      ) STRICT;

      CREATE INDEX knowledge_ocr_jobs_queue_idx
        ON knowledge_ocr_jobs (status, next_attempt_at, created_at);
      CREATE INDEX knowledge_ocr_jobs_asset_idx
        ON knowledge_ocr_jobs (asset_id, created_at DESC);

      CREATE TABLE knowledge_vector_backends (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('sqlite', 'remote')),
        endpoint TEXT NOT NULL DEFAULT '',
        collection_name TEXT NOT NULL DEFAULT 'knowledge_chunks',
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'error')),
        config_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(config_json)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE (workspace_id, name)
      ) STRICT;

      CREATE INDEX knowledge_vector_backends_workspace_idx
        ON knowledge_vector_backends (workspace_id, status);
    `
  },
  {
    version: 5,
    name: "monitoring_foundation",
    sql: `
      CREATE TABLE monitoring_site_reports (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        source_kind TEXT NOT NULL CHECK (source_kind IN ('remote_url', 'uploaded_html', 'local_directory')),
        source_url TEXT NOT NULL DEFAULT '',
        source_label TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
        overall_score REAL,
        rule_version TEXT NOT NULL DEFAULT 'yaojingang-georank-v1',
        weights_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(weights_json)),
        schema_analysis_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(schema_analysis_json)),
        content_analysis_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(content_analysis_json)),
        meta_analysis_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(meta_analysis_json)),
        citation_analysis_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(citation_analysis_json)),
        recommendations_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(recommendations_json)),
        content_hash TEXT,
        content_bytes INTEGER NOT NULL DEFAULT 0 CHECK (content_bytes >= 0),
        error_code TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL
      ) STRICT;

      CREATE INDEX monitoring_site_reports_workspace_idx
        ON monitoring_site_reports (workspace_id, created_at DESC);
      CREATE INDEX monitoring_site_reports_status_idx
        ON monitoring_site_reports (workspace_id, status, created_at DESC);

      CREATE TABLE monitoring_access_logs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        event_id TEXT,
        source TEXT NOT NULL DEFAULT 'local' CHECK (source IN ('local', 'server', 'channel')),
        occurred_at TEXT NOT NULL,
        method TEXT NOT NULL DEFAULT 'GET',
        path TEXT NOT NULL,
        status_code INTEGER NOT NULL DEFAULT 200 CHECK (status_code BETWEEN 100 AND 599),
        ip_hash TEXT NOT NULL DEFAULT '',
        user_agent TEXT NOT NULL DEFAULT '',
        traffic_type TEXT NOT NULL CHECK (traffic_type IN ('human', 'search_bot', 'ai_bot', 'other_bot', 'unknown')),
        bot_name TEXT NOT NULL DEFAULT '',
        article_id TEXT REFERENCES content_articles(id) ON DELETE SET NULL,
        channel_id TEXT,
        referer TEXT NOT NULL DEFAULT '',
        metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
        created_at TEXT NOT NULL,
        UNIQUE (workspace_id, source, event_id)
      ) STRICT;

      CREATE INDEX monitoring_access_logs_time_idx
        ON monitoring_access_logs (workspace_id, occurred_at DESC);
      CREATE INDEX monitoring_access_logs_type_idx
        ON monitoring_access_logs (workspace_id, traffic_type, occurred_at DESC);
      CREATE INDEX monitoring_access_logs_path_idx
        ON monitoring_access_logs (workspace_id, path, occurred_at DESC);
      CREATE INDEX monitoring_access_logs_article_idx
        ON monitoring_access_logs (workspace_id, article_id, occurred_at DESC);

      CREATE TABLE monitoring_log_batches (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('local', 'server', 'channel')),
        received_count INTEGER NOT NULL DEFAULT 0 CHECK (received_count >= 0),
        accepted_count INTEGER NOT NULL DEFAULT 0 CHECK (accepted_count >= 0),
        duplicate_count INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
        rejected_count INTEGER NOT NULL DEFAULT 0 CHECK (rejected_count >= 0),
        created_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL
      ) STRICT;

      CREATE INDEX monitoring_log_batches_workspace_idx
        ON monitoring_log_batches (workspace_id, created_at DESC);
    `
  },
  {
    version: 6,
    name: "official_site_contact_leads",
    sql: `
      CREATE TABLE site_contact_leads (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        company TEXT NOT NULL DEFAULT '',
        service TEXT NOT NULL DEFAULT '',
        website TEXT NOT NULL DEFAULT '',
        message TEXT NOT NULL DEFAULT '',
        source_url TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'closed', 'spam')),
        user_agent TEXT NOT NULL DEFAULT '',
        metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE INDEX site_contact_leads_workspace_idx
        ON site_contact_leads (workspace_id, status, created_at DESC);
    `
  },
  {
    version: 7,
    name: "official_site_cms_publication",
    sql: `
      CREATE TABLE site_cms_drafts (
        workspace_id TEXT PRIMARY KEY,
        revision INTEGER NOT NULL CHECK (revision >= 1),
        snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
        checksum TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
      ) STRICT;

      CREATE TABLE site_cms_releases (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        version_number INTEGER NOT NULL CHECK (version_number >= 1),
        source_draft_revision INTEGER NOT NULL CHECK (source_draft_revision >= 1),
        source_release_id TEXT REFERENCES site_cms_releases(id) ON DELETE SET NULL,
        operation TEXT NOT NULL CHECK (operation IN ('publish', 'rollback', 'bootstrap')),
        snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
        checksum TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE (workspace_id, version_number)
      ) STRICT;

      CREATE INDEX site_cms_releases_workspace_idx
        ON site_cms_releases (workspace_id, version_number DESC);

      CREATE TABLE site_cms_publications (
        workspace_id TEXT PRIMARY KEY,
        release_id TEXT NOT NULL REFERENCES site_cms_releases(id) ON DELETE RESTRICT,
        version_number INTEGER NOT NULL CHECK (version_number >= 1),
        published_at TEXT NOT NULL,
        published_by TEXT REFERENCES users(id) ON DELETE SET NULL
      ) STRICT;
    `
  },
  {
    version: 8,
    name: "operations_diagnostics_foundation",
    sql: `
      CREATE TABLE research_packages (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        package_key TEXT NOT NULL,
        name TEXT NOT NULL,
        dataset_version TEXT NOT NULL,
        source_repository TEXT NOT NULL,
        source_url TEXT NOT NULL,
        released_at TEXT,
        source_commit TEXT,
        checksum_sha256 TEXT,
        install_state TEXT NOT NULL DEFAULT 'metadata_only'
          CHECK (install_state IN ('metadata_only', 'staged', 'ready', 'failed', 'retired')),
        verification_status TEXT NOT NULL DEFAULT 'metadata_only'
          CHECK (verification_status IN ('metadata_only', 'unverified', 'verified')),
        is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
        is_immutable INTEGER NOT NULL DEFAULT 1 CHECK (is_immutable IN (0, 1)),
        statistics_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(statistics_json)),
        coverage_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(coverage_json)),
        limitations_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(limitations_json)),
        license_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(license_json)),
        manifest_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(manifest_json)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE (workspace_id, package_key, dataset_version)
      ) STRICT;

      CREATE INDEX research_packages_workspace_idx
        ON research_packages (workspace_id, is_active DESC, released_at DESC);

      CREATE TABLE diagnostic_projects (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        diagnostic_type TEXT NOT NULL
          CHECK (diagnostic_type IN ('industry_strategy', 'source_ecosystem', 'site_content', 'comprehensive')),
        industry TEXT NOT NULL DEFAULT '',
        target_brand TEXT NOT NULL DEFAULT '',
        website_url TEXT NOT NULL DEFAULT '',
        region TEXT NOT NULL DEFAULT '',
        business_line_id TEXT,
        objective TEXT NOT NULL DEFAULT '',
        scope_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(scope_json)),
        research_package_id TEXT REFERENCES research_packages(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'active', 'completed', 'archived')),
        revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
      ) STRICT;

      CREATE INDEX diagnostic_projects_workspace_idx
        ON diagnostic_projects (workspace_id, status, updated_at DESC);
      CREATE INDEX diagnostic_projects_line_idx
        ON diagnostic_projects (workspace_id, business_line_id, updated_at DESC);

      CREATE TABLE diagnostic_question_sets (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES diagnostic_projects(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL CHECK (version_number >= 1),
        name TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'frozen', 'superseded')),
        questions_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(questions_json)),
        checksum TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        frozen_at TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        frozen_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE (project_id, version_number)
      ) STRICT;

      CREATE INDEX diagnostic_question_sets_project_idx
        ON diagnostic_question_sets (project_id, version_number DESC);

      CREATE TABLE diagnostic_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES diagnostic_projects(id) ON DELETE CASCADE,
        question_set_id TEXT NOT NULL REFERENCES diagnostic_question_sets(id) ON DELETE RESTRICT,
        research_package_id TEXT REFERENCES research_packages(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'queued'
          CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
        input_snapshot_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(input_snapshot_json)),
        evidence_scope_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(evidence_scope_json)),
        evidence_summary_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(evidence_summary_json)),
        error_code TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL
      ) STRICT;

      CREATE INDEX diagnostic_runs_project_idx
        ON diagnostic_runs (project_id, created_at DESC);
      CREATE INDEX diagnostic_runs_status_idx
        ON diagnostic_runs (status, created_at);

      CREATE TABLE diagnostic_evidence (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES diagnostic_runs(id) ON DELETE CASCADE,
        evidence_type TEXT NOT NULL CHECK (evidence_type IN ('research', 'enterprise', 'live')),
        source_kind TEXT NOT NULL,
        source_id TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        source_url TEXT NOT NULL DEFAULT '',
        claim TEXT NOT NULL DEFAULT '',
        excerpt TEXT NOT NULL DEFAULT '',
        verification_status TEXT NOT NULL DEFAULT 'supplied'
          CHECK (verification_status IN ('supplied', 'verified', 'rejected', 'not_available')),
        observed_at TEXT,
        provenance_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(provenance_json)),
        payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json)),
        created_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL
      ) STRICT;

      CREATE INDEX diagnostic_evidence_run_idx
        ON diagnostic_evidence (run_id, evidence_type, created_at);

      CREATE TABLE diagnostic_metrics (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES diagnostic_runs(id) ON DELETE CASCADE,
        evidence_id TEXT REFERENCES diagnostic_evidence(id) ON DELETE SET NULL,
        evidence_type TEXT NOT NULL CHECK (evidence_type IN ('research', 'enterprise', 'live')),
        dimension TEXT NOT NULL,
        metric_key TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        value_json TEXT NOT NULL CHECK (json_valid(value_json)),
        unit TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'measured'
          CHECK (status IN ('measured', 'derived', 'not_available')),
        methodology TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        UNIQUE (run_id, evidence_type, dimension, metric_key)
      ) STRICT;

      CREATE INDEX diagnostic_metrics_run_idx
        ON diagnostic_metrics (run_id, evidence_type, dimension);

      CREATE TABLE diagnostic_reports (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES diagnostic_projects(id) ON DELETE CASCADE,
        run_id TEXT NOT NULL REFERENCES diagnostic_runs(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL CHECK (version_number >= 1),
        title TEXT NOT NULL,
        report_type TEXT NOT NULL
          CHECK (report_type IN ('industry_strategy', 'source_ecosystem', 'site_content', 'comprehensive')),
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'final', 'superseded')),
        executive_summary TEXT NOT NULL DEFAULT '',
        sections_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(sections_json)),
        methodology_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(methodology_json)),
        data_scope_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(data_scope_json)),
        limitations_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(limitations_json)),
        checksum TEXT NOT NULL,
        created_at TEXT NOT NULL,
        finalized_at TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        finalized_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE (run_id, version_number)
      ) STRICT;

      CREATE INDEX diagnostic_reports_project_idx
        ON diagnostic_reports (project_id, created_at DESC);

      CREATE TABLE diagnostic_recommendations (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL REFERENCES diagnostic_reports(id) ON DELETE CASCADE,
        category TEXT NOT NULL
          CHECK (category IN ('question_map', 'source_ecosystem', 'knowledge_gap', 'site_cms', 'content_plan', 'publishing')),
        priority TEXT NOT NULL DEFAULT 'medium'
          CHECK (priority IN ('critical', 'high', 'medium', 'low')),
        title TEXT NOT NULL,
        rationale TEXT NOT NULL DEFAULT '',
        expected_outcome TEXT NOT NULL DEFAULT '',
        evidence_refs_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(evidence_refs_json)),
        payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json)),
        status TEXT NOT NULL DEFAULT 'proposed'
          CHECK (status IN ('proposed', 'accepted', 'rejected', 'converted', 'closed')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
      ) STRICT;

      CREATE INDEX diagnostic_recommendations_report_idx
        ON diagnostic_recommendations (report_id, status, priority);

      CREATE TABLE diagnostic_actions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES diagnostic_projects(id) ON DELETE CASCADE,
        recommendation_id TEXT REFERENCES diagnostic_recommendations(id) ON DELETE SET NULL,
        action_type TEXT NOT NULL
          CHECK (action_type IN ('question_library_candidate', 'knowledge_gap', 'topic_candidate', 'content_plan', 'cms_task', 'publishing_strategy')),
        status TEXT NOT NULL DEFAULT 'proposed'
          CHECK (status IN ('proposed', 'accepted', 'applied', 'rejected', 'failed', 'cancelled')),
        payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json)),
        target_entity_type TEXT NOT NULL DEFAULT '',
        target_entity_id TEXT NOT NULL DEFAULT '',
        result_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(result_json)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        decided_at TEXT,
        applied_at TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
      ) STRICT;

      CREATE INDEX diagnostic_actions_project_idx
        ON diagnostic_actions (project_id, status, created_at DESC);
      CREATE INDEX diagnostic_actions_recommendation_idx
        ON diagnostic_actions (recommendation_id, status);
    `
  },
  {
    version: 9,
    name: "ai_analysis_workbench",
    sql: `
      CREATE TABLE analysis_sessions (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'archived')),
        provider_id TEXT NOT NULL DEFAULT '',
        model TEXT NOT NULL DEFAULT '',
        data_sources_json TEXT NOT NULL DEFAULT '["citation_lab"]' CHECK (json_valid(data_sources_json)),
        platforms_json TEXT NOT NULL DEFAULT '["豆包","DeepSeek","千问","元宝"]' CHECK (json_valid(platforms_json)),
        report_depth TEXT NOT NULL DEFAULT 'detailed'
          CHECK (report_depth IN ('quick', 'detailed', 'custom')),
        output_format TEXT NOT NULL DEFAULT 'interactive'
          CHECK (output_format IN ('interactive', 'markdown', 'html')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
      ) STRICT;

      CREATE INDEX analysis_sessions_workspace_idx
        ON analysis_sessions (workspace_id, status, updated_at DESC);

      CREATE TABLE analysis_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content_text TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
        created_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL
      ) STRICT;

      CREATE INDEX analysis_messages_session_idx
        ON analysis_messages (session_id, created_at ASC);

      CREATE TABLE analysis_runs (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
        user_message_id TEXT REFERENCES analysis_messages(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'queued'
          CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
        provider_id TEXT NOT NULL DEFAULT '',
        model TEXT NOT NULL DEFAULT '',
        request_snapshot_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(request_snapshot_json)),
        plan_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(plan_json)),
        error_code TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL
      ) STRICT;

      CREATE INDEX analysis_runs_session_idx
        ON analysis_runs (session_id, created_at DESC);

      CREATE TABLE analysis_tool_calls (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
        ordinal INTEGER NOT NULL CHECK (ordinal >= 1),
        tool_name TEXT NOT NULL,
        arguments_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(arguments_json)),
        status TEXT NOT NULL DEFAULT 'queued'
          CHECK (status IN ('queued', 'running', 'completed', 'failed')),
        evidence_id TEXT NOT NULL,
        result_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(result_json)),
        error_message TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        UNIQUE (run_id, ordinal)
      ) STRICT;

      CREATE INDEX analysis_tool_calls_run_idx
        ON analysis_tool_calls (run_id, ordinal);

      CREATE TABLE analysis_artifacts (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
        run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL CHECK (version_number >= 1),
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'final' CHECK (status IN ('draft', 'final', 'superseded')),
        executive_summary TEXT NOT NULL DEFAULT '',
        sections_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(sections_json)),
        recommendations_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(recommendations_json)),
        limitations_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(limitations_json)),
        follow_up_suggestions_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(follow_up_suggestions_json)),
        methodology_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(methodology_json)),
        created_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE (session_id, version_number)
      ) STRICT;

      CREATE INDEX analysis_artifacts_session_idx
        ON analysis_artifacts (session_id, version_number DESC);
    `
  },
  {
    version: 10,
    name: "knowledge_upload_immediately_available",
    sql: `
      UPDATE knowledge_document_versions
      SET review_status = 'approved', approved_at = COALESCE(approved_at, updated_at)
      WHERE review_status IN ('draft', 'pending') AND extraction_status = 'complete';

      UPDATE knowledge_assets
      SET review_status = 'approved'
      WHERE review_status = 'pending';

      INSERT INTO knowledge_index_jobs (id, version_id, job_type, status, attempts, created_at)
      SELECT 'KJOB-migration-' || lower(hex(randomblob(16))), v.id, 'index', 'queued', 0, datetime('now')
      FROM knowledge_document_versions v
      WHERE v.review_status = 'approved'
        AND v.extraction_status = 'complete'
        AND v.index_status <> 'indexed'
        AND NOT EXISTS (
          SELECT 1 FROM knowledge_index_jobs j
          WHERE j.version_id = v.id AND j.status IN ('queued', 'running')
        );
    `
  },
  {
    version: 11,
    name: "knowledge_asset_file_storage",
    sql: `
      ALTER TABLE knowledge_assets ADD COLUMN storage_key TEXT NOT NULL DEFAULT '';
      CREATE INDEX knowledge_assets_storage_idx ON knowledge_assets (storage_key);
    `
  },
  {
    version: 12,
    name: "knowledge_provenance_and_active_version",
    sql: `
      ALTER TABLE knowledge_retrieval_runs ADD COLUMN embedding_provider_id TEXT;
      ALTER TABLE knowledge_retrieval_runs ADD COLUMN embedding_source TEXT NOT NULL DEFAULT '';
      ALTER TABLE knowledge_retrieval_runs ADD COLUMN embedding_fallback_reason TEXT;

      CREATE INDEX knowledge_versions_latest_active_idx
        ON knowledge_document_versions (document_id, review_status, index_status, version DESC);
      CREATE INDEX knowledge_assets_library_hash_idx
        ON knowledge_assets (workspace_id, library_id, content_hash, review_status);

      UPDATE knowledge_ocr_jobs
      SET version_id = (
        SELECT a.version_id FROM knowledge_assets a WHERE a.id = knowledge_ocr_jobs.asset_id
      )
      WHERE version_id IS NULL
        AND EXISTS (
          SELECT 1 FROM knowledge_assets a
          WHERE a.id = knowledge_ocr_jobs.asset_id AND a.version_id IS NOT NULL
        );
    `
  },
  {
    version: 13,
    name: "diagnostic_relay_delivery_sync",
    sql: `
      CREATE TABLE diagnostic_relay_links (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        diagnostic_run_id TEXT NOT NULL UNIQUE REFERENCES diagnostic_runs(id) ON DELETE CASCADE,
        relay_run_id TEXT UNIQUE,
        client_run_id TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        question_set_checksum TEXT NOT NULL DEFAULT '',
        request_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(request_json)),
        remote_run_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(remote_run_json)),
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'submitted', 'running', 'completed', 'partial', 'failed', 'attention', 'cancelled')),
        error_code TEXT,
        error_message TEXT,
        last_pulled_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (workspace_id, idempotency_key)
      ) STRICT;

      CREATE INDEX diagnostic_relay_links_workspace_idx
        ON diagnostic_relay_links (workspace_id, status, updated_at DESC);
      CREATE INDEX diagnostic_relay_links_relay_run_idx
        ON diagnostic_relay_links (relay_run_id);

      CREATE TABLE diagnostic_relay_delivery_receipts (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        delivery_id TEXT NOT NULL,
        diagnostic_run_id TEXT NOT NULL REFERENCES diagnostic_runs(id) ON DELETE CASCADE,
        relay_run_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json)),
        status TEXT NOT NULL DEFAULT 'processing'
          CHECK (status IN ('processing', 'synced', 'failed')),
        evidence_id TEXT,
        error_code TEXT,
        error_message TEXT,
        received_at TEXT NOT NULL,
        acknowledged_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (workspace_id, delivery_id),
        UNIQUE (workspace_id, evidence_id)
      ) STRICT;

      CREATE INDEX diagnostic_relay_receipts_run_idx
        ON diagnostic_relay_delivery_receipts (diagnostic_run_id, status, created_at DESC);
      CREATE INDEX diagnostic_relay_receipts_relay_run_idx
        ON diagnostic_relay_delivery_receipts (relay_run_id, created_at DESC);
    `
  },
  {
    version: 14,
    name: "diagnostic_brand_monitoring_plans",
    sql: `
      -- A monitoring plan is deliberately separate from a relay run.  The
      -- plan owns the ongoing authorization, fixed question-set version and
      -- spending guard; every occurrence still becomes its own immutable
      -- diagnostic/relay run and therefore its own live-evidence snapshot.
      CREATE TABLE diagnostic_monitoring_plans (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        project_id TEXT NOT NULL REFERENCES diagnostic_projects(id) ON DELETE CASCADE,
        question_set_id TEXT NOT NULL REFERENCES diagnostic_question_sets(id) ON DELETE RESTRICT,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'paused', 'attention', 'archived')),
        schedule_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(schedule_json)),
        request_snapshot_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(request_snapshot_json)),
        authorization_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(authorization_json)),
        max_credits_per_run INTEGER NOT NULL CHECK (max_credits_per_run >= 1),
        max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts >= 1 AND max_attempts <= 5),
        failure_threshold INTEGER NOT NULL DEFAULT 3 CHECK (failure_threshold >= 1 AND failure_threshold <= 10),
        last_quote_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(last_quote_json)),
        last_quoted_at TEXT,
        next_run_at TEXT,
        last_scheduled_at TEXT,
        last_run_at TEXT,
        last_success_at TEXT,
        consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
        last_error_code TEXT,
        last_error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
      ) STRICT;

      CREATE INDEX diagnostic_monitoring_plans_due_idx
        ON diagnostic_monitoring_plans (workspace_id, status, next_run_at);
      CREATE INDEX diagnostic_monitoring_plans_project_idx
        ON diagnostic_monitoring_plans (project_id, updated_at DESC);

      CREATE TABLE diagnostic_monitoring_plan_runs (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES diagnostic_monitoring_plans(id) ON DELETE CASCADE,
        workspace_id TEXT NOT NULL,
        trigger_kind TEXT NOT NULL CHECK (trigger_kind IN ('scheduled', 'manual')),
        scheduled_for TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued'
          CHECK (status IN ('queued', 'submitting', 'submitted', 'running', 'completed', 'partial', 'failed', 'attention', 'cancelled', 'skipped')),
        diagnostic_run_id TEXT UNIQUE REFERENCES diagnostic_runs(id) ON DELETE SET NULL,
        relay_link_id TEXT,
        client_run_id TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        request_snapshot_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(request_snapshot_json)),
        quote_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(quote_json)),
        estimated_customer_credits INTEGER,
        attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        next_attempt_at TEXT,
        error_code TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        updated_at TEXT NOT NULL,
        UNIQUE (plan_id, trigger_kind, scheduled_for),
        UNIQUE (workspace_id, idempotency_key)
      ) STRICT;

      CREATE INDEX diagnostic_monitoring_plan_runs_active_idx
        ON diagnostic_monitoring_plan_runs (plan_id, status, next_attempt_at);
      CREATE INDEX diagnostic_monitoring_plan_runs_workspace_idx
        ON diagnostic_monitoring_plan_runs (workspace_id, created_at DESC);
      CREATE INDEX diagnostic_monitoring_plan_runs_diagnostic_idx
        ON diagnostic_monitoring_plan_runs (diagnostic_run_id);
    `
  },
  {
    version: 15,
    name: "diagnostic_brand_monitoring_monthly_budget_cap",
    sql: `
      -- 0 means the customer's central instance limits are the only cap.
      -- A positive value is a private-instance safety guard based on this
      -- plan's submitted/held estimates in the calendar month.
      ALTER TABLE diagnostic_monitoring_plans
        ADD COLUMN max_monthly_credits INTEGER NOT NULL DEFAULT 0 CHECK (max_monthly_credits >= 0);
    `
  },
  {
    version: 16,
    name: "content_asset_publication_tracking",
    sql: `
      CREATE TABLE content_assets (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        article_id TEXT NOT NULL REFERENCES content_articles(id) ON DELETE CASCADE,
        title_snapshot TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'tracking'
          CHECK (status IN ('tracking', 'paused', 'archived')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE (workspace_id, article_id)
      ) STRICT;

      CREATE INDEX content_assets_workspace_idx
        ON content_assets (workspace_id, status, updated_at DESC);

      CREATE TABLE content_asset_publications (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        asset_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
        article_id TEXT NOT NULL REFERENCES content_articles(id) ON DELETE CASCADE,
        article_version_id TEXT REFERENCES content_article_versions(id) ON DELETE SET NULL,
        publisher_job_id TEXT,
        platform_code TEXT NOT NULL,
        platform_name TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('publish_sync', 'manual', 'import')),
        url TEXT NOT NULL,
        canonical_url TEXT NOT NULL,
        resolved_url TEXT,
        declared_canonical_url TEXT,
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'invalid', 'removed')),
        health_status TEXT NOT NULL DEFAULT 'unchecked'
          CHECK (health_status IN ('unchecked', 'healthy', 'redirected', 'unreachable', 'blocked', 'changed')),
        http_status INTEGER,
        content_type TEXT,
        content_hash TEXT,
        last_error_code TEXT,
        last_error_message TEXT,
        published_at TEXT,
        last_checked_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
        UNIQUE (workspace_id, asset_id, canonical_url)
      ) STRICT;

      CREATE INDEX content_asset_publications_asset_idx
        ON content_asset_publications (workspace_id, asset_id, status, updated_at DESC);
      CREATE INDEX content_asset_publications_article_idx
        ON content_asset_publications (workspace_id, article_id, platform_code, updated_at DESC);
      CREATE INDEX content_asset_publications_health_idx
        ON content_asset_publications (workspace_id, health_status, last_checked_at);
      CREATE UNIQUE INDEX content_asset_publications_publisher_target_idx
        ON content_asset_publications (workspace_id, publisher_job_id, platform_code)
        WHERE publisher_job_id IS NOT NULL AND status != 'removed';
    `
  },
  {
    version: 17,
    name: "content_asset_citations_patrol_and_alerts",
    sql: `
      ALTER TABLE content_asset_publications
        ADD COLUMN next_check_at TEXT;
      ALTER TABLE content_asset_publications
        ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0);
      ALTER TABLE content_asset_publications
        ADD COLUMN last_healthy_at TEXT;

      CREATE INDEX content_asset_publications_due_idx
        ON content_asset_publications (workspace_id, status, next_check_at, last_checked_at);

      CREATE TABLE content_asset_citations (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        asset_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
        publication_id TEXT NOT NULL REFERENCES content_asset_publications(id) ON DELETE CASCADE,
        article_id TEXT NOT NULL REFERENCES content_articles(id) ON DELETE CASCADE,
        evidence_id TEXT NOT NULL REFERENCES diagnostic_evidence(id) ON DELETE CASCADE,
        diagnostic_run_id TEXT NOT NULL REFERENCES diagnostic_runs(id) ON DELETE CASCADE,
        question_id TEXT,
        question_text TEXT NOT NULL DEFAULT '',
        platform_code TEXT NOT NULL DEFAULT '',
        terminal_code TEXT NOT NULL DEFAULT '',
        mode_code TEXT NOT NULL DEFAULT '',
        source_url TEXT NOT NULL,
        canonical_source_url TEXT NOT NULL,
        source_title TEXT NOT NULL DEFAULT '',
        source_rank INTEGER,
        match_kind TEXT NOT NULL CHECK (match_kind IN ('canonical', 'resolved', 'declared_canonical')),
        observed_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
        UNIQUE (workspace_id, evidence_id, publication_id, canonical_source_url)
      ) STRICT;

      CREATE INDEX content_asset_citations_asset_idx
        ON content_asset_citations (workspace_id, asset_id, observed_at DESC);
      CREATE INDEX content_asset_citations_evidence_idx
        ON content_asset_citations (workspace_id, evidence_id);
      CREATE INDEX content_asset_citations_question_idx
        ON content_asset_citations (workspace_id, question_id, platform_code, observed_at DESC);

      CREATE TABLE content_asset_alerts (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        asset_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
        publication_id TEXT REFERENCES content_asset_publications(id) ON DELETE CASCADE,
        alert_type TEXT NOT NULL CHECK (alert_type IN ('url_unreachable', 'url_changed', 'url_redirected', 'citation_first', 'citation_stale')),
        severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
        dedupe_key TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL DEFAULT '',
        details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        resolved_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (workspace_id, dedupe_key)
      ) STRICT;

      CREATE INDEX content_asset_alerts_status_idx
        ON content_asset_alerts (workspace_id, status, severity, last_seen_at DESC);
      CREATE INDEX content_asset_alerts_asset_idx
        ON content_asset_alerts (workspace_id, asset_id, updated_at DESC);
    `
  },
  {
    version: 18,
    name: "geo_foundation_assets",
    sql: `
      CREATE TABLE methodology_packs (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL,
        scope TEXT NOT NULL CHECK (scope IN ('global', 'industry', 'project')),
        industry_template TEXT NOT NULL DEFAULT '',
        tenant_id TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        CHECK (
          (scope = 'global' AND industry_template = '' AND tenant_id = '') OR
          (scope = 'industry' AND industry_template <> '' AND tenant_id = '') OR
          (scope = 'project' AND industry_template = '' AND tenant_id <> '')
        ),
        UNIQUE (key, scope, industry_template, tenant_id)
      ) STRICT;

      CREATE TABLE methodology_versions (
        id TEXT PRIMARY KEY,
        pack_id TEXT NOT NULL REFERENCES methodology_packs(id) ON DELETE CASCADE,
        version INTEGER NOT NULL CHECK (version >= 1),
        content TEXT NOT NULL,
        sources_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(sources_json) AND json_type(sources_json) = 'array'),
        checksum TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'retired')),
        created_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        published_at TEXT,
        published_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE (pack_id, version),
        UNIQUE (checksum)
      ) STRICT;

      CREATE INDEX methodology_versions_pack_idx ON methodology_versions (pack_id, status, version DESC);

      CREATE TABLE prompt_templates (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL,
        scope TEXT NOT NULL CHECK (scope IN ('global', 'industry', 'project')),
        industry_template TEXT NOT NULL DEFAULT '',
        tenant_id TEXT NOT NULL DEFAULT '',
        operation TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        CHECK (
          (scope = 'global' AND industry_template = '' AND tenant_id = '') OR
          (scope = 'industry' AND industry_template <> '' AND tenant_id = '') OR
          (scope = 'project' AND industry_template = '' AND tenant_id <> '')
        ),
        UNIQUE (key, scope, industry_template, tenant_id)
      ) STRICT;

      CREATE TABLE prompt_versions (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
        version INTEGER NOT NULL CHECK (version >= 1),
        system_prompt TEXT NOT NULL,
        user_template TEXT NOT NULL,
        variables_schema_json TEXT NOT NULL CHECK (json_valid(variables_schema_json) AND json_type(variables_schema_json) = 'object'),
        output_schema_json TEXT NOT NULL CHECK (json_valid(output_schema_json) AND json_type(output_schema_json) = 'object'),
        quality_rules_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(quality_rules_json) AND json_type(quality_rules_json) = 'array'),
        checksum TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'retired')),
        created_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        published_at TEXT,
        published_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE (template_id, version),
        UNIQUE (checksum)
      ) STRICT;

      CREATE INDEX prompt_versions_template_idx ON prompt_versions (template_id, status, version DESC);

      CREATE TABLE quality_rule_packs (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL,
        scope TEXT NOT NULL CHECK (scope IN ('global', 'industry', 'project')),
        industry_template TEXT NOT NULL DEFAULT '',
        tenant_id TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        version INTEGER NOT NULL CHECK (version >= 1),
        rules_json TEXT NOT NULL CHECK (json_valid(rules_json) AND json_type(rules_json) = 'array'),
        checksum TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'retired')),
        created_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        published_at TEXT,
        published_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        CHECK (
          (scope = 'global' AND industry_template = '' AND tenant_id = '') OR
          (scope = 'industry' AND industry_template <> '' AND tenant_id = '') OR
          (scope = 'project' AND industry_template = '' AND tenant_id <> '')
        ),
        UNIQUE (key, scope, industry_template, tenant_id, version),
        UNIQUE (checksum)
      ) STRICT;

      CREATE TABLE prompt_test_cases (
        id TEXT PRIMARY KEY,
        prompt_version_id TEXT NOT NULL REFERENCES prompt_versions(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        input_fixture_json TEXT NOT NULL CHECK (json_valid(input_fixture_json) AND json_type(input_fixture_json) = 'object'),
        expected_rules_json TEXT NOT NULL CHECK (json_valid(expected_rules_json) AND json_type(expected_rules_json) = 'array'),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
        created_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE (prompt_version_id, name)
      ) STRICT;

      ALTER TABLE content_plans ADD COLUMN methodology_version_id TEXT REFERENCES methodology_versions(id) ON DELETE RESTRICT;
      ALTER TABLE content_plans ADD COLUMN prompt_version_id TEXT REFERENCES prompt_versions(id) ON DELETE RESTRICT;
      ALTER TABLE content_plans ADD COLUMN quality_rule_pack_id TEXT REFERENCES quality_rule_packs(id) ON DELETE RESTRICT;

      CREATE INDEX content_plans_foundation_idx ON content_plans (workspace_id, methodology_version_id, prompt_version_id);

      CREATE TRIGGER methodology_versions_published_immutable
      BEFORE UPDATE ON methodology_versions
      WHEN OLD.status = 'published'
      BEGIN SELECT RAISE(ABORT, 'published methodology version is immutable'); END;
      CREATE TRIGGER methodology_versions_published_no_delete
      BEFORE DELETE ON methodology_versions
      WHEN OLD.status = 'published'
      BEGIN SELECT RAISE(ABORT, 'published methodology version cannot be deleted'); END;
      CREATE TRIGGER prompt_versions_published_immutable
      BEFORE UPDATE ON prompt_versions
      WHEN OLD.status = 'published'
      BEGIN SELECT RAISE(ABORT, 'published prompt version is immutable'); END;
      CREATE TRIGGER prompt_versions_published_no_delete
      BEFORE DELETE ON prompt_versions
      WHEN OLD.status = 'published'
      BEGIN SELECT RAISE(ABORT, 'published prompt version cannot be deleted'); END;
      CREATE TRIGGER quality_rule_packs_published_immutable
      BEFORE UPDATE ON quality_rule_packs
      WHEN OLD.status = 'published'
      BEGIN SELECT RAISE(ABORT, 'published quality rule pack is immutable'); END;
      CREATE TRIGGER quality_rule_packs_published_no_delete
      BEFORE DELETE ON quality_rule_packs
      WHEN OLD.status = 'published'
      BEGIN SELECT RAISE(ABORT, 'published quality rule pack cannot be deleted'); END;
    `
  },
  {
    version: 19,
    name: "methodology_source_reviews",
    sql: `
      CREATE TABLE methodology_source_reviews (
        id TEXT PRIMARY KEY,
        methodology_version_id TEXT NOT NULL REFERENCES methodology_versions(id) ON DELETE CASCADE,
        rule_id TEXT NOT NULL,
        theme TEXT NOT NULL,
        rule_text TEXT NOT NULL,
        source_path TEXT NOT NULL,
        source_locator TEXT NOT NULL,
        source_excerpt TEXT NOT NULL DEFAULT '',
        source_sha256 TEXT NOT NULL CHECK (length(source_sha256) = 64 AND source_sha256 NOT GLOB '*[^0-9a-f]*'),
        classification TEXT NOT NULL,
        applicability TEXT NOT NULL DEFAULT '',
        license_status TEXT NOT NULL DEFAULT '',
        reuse_decision TEXT NOT NULL CHECK (reuse_decision IN ('candidate-global-after-approval', 'approved-global', 'review-only', 'rejected')),
        review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
        review_note TEXT NOT NULL DEFAULT '',
        reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (methodology_version_id, rule_id)
      ) STRICT;

      CREATE INDEX methodology_source_reviews_version_idx
        ON methodology_source_reviews (methodology_version_id, review_status, reuse_decision);

      CREATE TRIGGER methodology_source_reviews_published_no_insert
      BEFORE INSERT ON methodology_source_reviews
      WHEN EXISTS (SELECT 1 FROM methodology_versions WHERE id = NEW.methodology_version_id AND status = 'published')
      BEGIN SELECT RAISE(ABORT, 'published methodology source reviews are immutable'); END;
      CREATE TRIGGER methodology_source_reviews_published_immutable
      BEFORE UPDATE ON methodology_source_reviews
      WHEN EXISTS (SELECT 1 FROM methodology_versions WHERE id = OLD.methodology_version_id AND status = 'published')
      BEGIN SELECT RAISE(ABORT, 'published methodology source reviews are immutable'); END;
      CREATE TRIGGER methodology_source_reviews_published_no_delete
      BEFORE DELETE ON methodology_source_reviews
      WHEN EXISTS (SELECT 1 FROM methodology_versions WHERE id = OLD.methodology_version_id AND status = 'published')
      BEGIN SELECT RAISE(ABORT, 'published methodology source reviews are immutable'); END;
    `
  },
  {
    version: 20,
    name: "official_site_release_tenant_boundary",
    sql: `
      CREATE TRIGGER site_cms_publications_release_boundary_insert
      BEFORE INSERT ON site_cms_publications
      WHEN NOT EXISTS (
        SELECT 1 FROM site_cms_releases r
        WHERE r.id = NEW.release_id
          AND r.workspace_id = NEW.workspace_id
          AND r.version_number = NEW.version_number
      )
      BEGIN SELECT RAISE(ABORT, 'site publication release boundary mismatch'); END;

      CREATE TRIGGER site_cms_publications_release_boundary_update
      BEFORE UPDATE OF workspace_id, release_id, version_number ON site_cms_publications
      WHEN NOT EXISTS (
        SELECT 1 FROM site_cms_releases r
        WHERE r.id = NEW.release_id
          AND r.workspace_id = NEW.workspace_id
          AND r.version_number = NEW.version_number
      )
      BEGIN SELECT RAISE(ABORT, 'site publication release boundary mismatch'); END;

      CREATE TRIGGER site_cms_releases_source_boundary_insert
      BEFORE INSERT ON site_cms_releases
      WHEN NEW.source_release_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM site_cms_releases source
        WHERE source.id = NEW.source_release_id
          AND source.workspace_id = NEW.workspace_id
      )
      BEGIN SELECT RAISE(ABORT, 'site release source boundary mismatch'); END;

      CREATE TRIGGER site_cms_releases_immutable
      BEFORE UPDATE ON site_cms_releases
      BEGIN SELECT RAISE(ABORT, 'site CMS release is immutable'); END;

      CREATE TRIGGER site_cms_releases_no_delete
      BEFORE DELETE ON site_cms_releases
      BEGIN SELECT RAISE(ABORT, 'site CMS release cannot be deleted'); END;
    `
  },
  {
    version: 21,
    name: "official_site_cms_workflow_state",
    sql: `
      CREATE TABLE site_cms_workflow_state (
        workspace_id TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('draft', 'pending_review', 'approved', 'published', 'rejected', 'unpublished')),
        changed_at TEXT NOT NULL,
        changed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        reason TEXT NOT NULL DEFAULT '',
        review_at TEXT,
        reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        review_reason TEXT NOT NULL DEFAULT ''
      ) STRICT;
    `
  },
  {
    version: 22,
    name: "official_site_lead_contract",
    sql: `
      ALTER TABLE site_contact_leads RENAME TO site_contact_leads_legacy;

      CREATE TABLE site_contact_leads (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        company TEXT NOT NULL DEFAULT '',
        phone_or_email TEXT NOT NULL,
        need TEXT NOT NULL DEFAULT '',
        source_page TEXT NOT NULL DEFAULT '',
        utm_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(utm_json)),
        status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacting', 'qualified', 'won', 'lost', 'spam')),
        follow_up_at TEXT,
        owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        phone TEXT NOT NULL DEFAULT '',
        service TEXT NOT NULL DEFAULT '',
        website TEXT NOT NULL DEFAULT '',
        message TEXT NOT NULL DEFAULT '',
        source_url TEXT NOT NULL DEFAULT '',
        user_agent TEXT NOT NULL DEFAULT '',
        metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (workspace_id = tenant_id)
      ) STRICT;

      INSERT INTO site_contact_leads (
        id, workspace_id, tenant_id, project_id, name, company, phone_or_email,
        need, source_page, status, phone, service, website, message, source_url,
        user_agent, metadata_json, created_at, updated_at
      )
      SELECT
        id, workspace_id, workspace_id, workspace_id, name, company, phone,
        message, source_url,
        CASE status WHEN 'contacted' THEN 'contacting' WHEN 'closed' THEN 'lost' ELSE status END,
        phone, service, website, message, source_url, user_agent, metadata_json,
        created_at, updated_at
      FROM site_contact_leads_legacy;

      DROP TABLE site_contact_leads_legacy;

      CREATE INDEX site_contact_leads_workspace_idx
        ON site_contact_leads (workspace_id, status, created_at DESC);

      CREATE INDEX site_contact_leads_tenant_project_idx
        ON site_contact_leads (tenant_id, project_id, status, created_at DESC);
      CREATE INDEX site_contact_leads_owner_follow_up_idx
        ON site_contact_leads (tenant_id, project_id, owner_id, follow_up_at);

      CREATE TRIGGER site_contact_leads_contract_insert
      BEFORE INSERT ON site_contact_leads
      WHEN NEW.tenant_id = '' OR NEW.project_id = '' OR NEW.phone_or_email = ''
        OR NEW.workspace_id != NEW.tenant_id
        OR NEW.status NOT IN ('new', 'contacting', 'qualified', 'won', 'lost', 'spam')
      BEGIN SELECT RAISE(ABORT, 'site lead contract violation'); END;

      CREATE TRIGGER site_contact_leads_contract_update
      BEFORE UPDATE OF workspace_id, tenant_id, project_id, phone_or_email, status ON site_contact_leads
      WHEN NEW.tenant_id = '' OR NEW.project_id = '' OR NEW.phone_or_email = ''
        OR NEW.workspace_id != NEW.tenant_id
        OR NEW.status NOT IN ('new', 'contacting', 'qualified', 'won', 'lost', 'spam')
      BEGIN SELECT RAISE(ABORT, 'site lead contract violation'); END;
    `
  },
  {
    version: 23,
    name: "official_site_lead_idempotency",
    sql: `
      ALTER TABLE site_contact_leads ADD COLUMN idempotency_key TEXT NOT NULL DEFAULT '';
      ALTER TABLE site_contact_leads ADD COLUMN submission_hash TEXT NOT NULL DEFAULT '';

      CREATE UNIQUE INDEX site_contact_leads_idempotency_idx
        ON site_contact_leads (tenant_id, project_id, idempotency_key)
        WHERE idempotency_key <> '';

      CREATE TRIGGER site_contact_leads_idempotency_immutable
      BEFORE UPDATE OF idempotency_key, submission_hash ON site_contact_leads
      WHEN NEW.idempotency_key != OLD.idempotency_key OR NEW.submission_hash != OLD.submission_hash
      BEGIN SELECT RAISE(ABORT, 'site lead idempotency identity is immutable'); END;
    `
  },
  {
    version: 24,
    name: "official_site_lead_follow_up",
    sql: `
      CREATE TABLE site_lead_follow_ups (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        lead_id TEXT NOT NULL REFERENCES site_contact_leads(id) ON DELETE RESTRICT,
        event_type TEXT NOT NULL CHECK (event_type IN ('claimed', 'follow_up', 'status_changed')),
        status_from TEXT NOT NULL CHECK (status_from IN ('new', 'contacting', 'qualified', 'won', 'lost', 'spam')),
        status_to TEXT NOT NULL CHECK (status_to IN ('new', 'contacting', 'qualified', 'won', 'lost', 'spam')),
        owner_from TEXT REFERENCES users(id) ON DELETE SET NULL,
        owner_to TEXT REFERENCES users(id) ON DELETE SET NULL,
        note TEXT NOT NULL DEFAULT '',
        follow_up_at TEXT,
        created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE INDEX site_lead_follow_ups_lead_idx
        ON site_lead_follow_ups (tenant_id, project_id, lead_id, created_at DESC);
      CREATE INDEX site_lead_follow_ups_actor_idx
        ON site_lead_follow_ups (tenant_id, project_id, created_by, created_at DESC);

      CREATE TRIGGER site_lead_follow_ups_boundary_insert
      BEFORE INSERT ON site_lead_follow_ups
      WHEN NOT EXISTS (
        SELECT 1 FROM site_contact_leads lead
        WHERE lead.id = NEW.lead_id
          AND lead.tenant_id = NEW.tenant_id
          AND lead.project_id = NEW.project_id
      )
      BEGIN SELECT RAISE(ABORT, 'site lead follow-up boundary mismatch'); END;

      CREATE TRIGGER site_lead_follow_ups_immutable
      BEFORE UPDATE ON site_lead_follow_ups
      BEGIN SELECT RAISE(ABORT, 'site lead follow-up is immutable'); END;
      CREATE TRIGGER site_lead_follow_ups_no_delete
      BEFORE DELETE ON site_lead_follow_ups
      BEGIN SELECT RAISE(ABORT, 'site lead follow-up cannot be deleted'); END;
    `
  },
  {
    version: 25,
    name: "idempotent_publication_tasks",
    sql: `
      CREATE TABLE publication_tasks (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        content_id TEXT NOT NULL REFERENCES content_articles(id) ON DELETE RESTRICT,
        content_version_id TEXT NOT NULL REFERENCES content_article_versions(id) ON DELETE RESTRICT,
        channel TEXT NOT NULL,
        payload_hash TEXT NOT NULL CHECK (length(payload_hash) = 64 AND payload_hash NOT GLOB '*[^0-9a-f]*'),
        status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'claimed', 'running', 'draft_saved', 'published', 'failed', 'expired')),
        attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        external_job_id TEXT,
        payload_json TEXT NOT NULL CHECK (json_valid(payload_json) AND json_type(payload_json) = 'object'),
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (tenant_id, content_version_id, channel)
      ) STRICT;

      CREATE INDEX publication_tasks_queue_idx
        ON publication_tasks (tenant_id, status, expires_at, created_at);
      CREATE INDEX publication_tasks_content_idx
        ON publication_tasks (tenant_id, content_id, content_version_id, created_at DESC);

      CREATE TRIGGER publication_tasks_content_boundary_insert
      BEFORE INSERT ON publication_tasks
      WHEN NOT EXISTS (
        SELECT 1 FROM content_articles article
        JOIN content_article_versions version ON version.article_id = article.id
        WHERE article.id = NEW.content_id
          AND article.workspace_id = NEW.tenant_id
          AND version.id = NEW.content_version_id
      )
      BEGIN SELECT RAISE(ABORT, 'publication task content boundary mismatch'); END;

      CREATE TRIGGER publication_tasks_identity_immutable
      BEFORE UPDATE OF tenant_id, content_id, content_version_id, channel, payload_hash, payload_json, created_at, created_by ON publication_tasks
      BEGIN SELECT RAISE(ABORT, 'publication task identity is immutable'); END;
      CREATE TRIGGER publication_tasks_no_delete_after_dispatch
      BEFORE DELETE ON publication_tasks
      WHEN OLD.external_job_id IS NOT NULL OR OLD.status != 'queued'
      BEGIN SELECT RAISE(ABORT, 'dispatched publication task cannot be deleted'); END;
    `
  },
  {
    version: 26,
    name: "publication_task_execution_state",
    sql: `
      ALTER TABLE publication_tasks ADD COLUMN claimed_by_device_id TEXT;
      ALTER TABLE publication_tasks ADD COLUMN claimed_at TEXT;
      ALTER TABLE publication_tasks ADD COLUMN next_attempt_at TEXT;
      ALTER TABLE publication_tasks ADD COLUMN remote_url TEXT NOT NULL DEFAULT '';
      ALTER TABLE publication_tasks ADD COLUMN error_code TEXT;
      ALTER TABLE publication_tasks ADD COLUMN error_message TEXT;
      ALTER TABLE publication_tasks ADD COLUMN result_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(result_json) AND json_type(result_json) = 'object');
      ALTER TABLE publication_tasks ADD COLUMN completed_at TEXT;

      CREATE INDEX publication_tasks_retry_idx
        ON publication_tasks (tenant_id, status, next_attempt_at, attempts);
    `
  },
  {
    version: 27,
    name: "publication_task_worker_lookup",
    sql: `
      CREATE INDEX publication_tasks_worker_job_idx
        ON publication_tasks (tenant_id, external_job_id, status, expires_at);
      CREATE INDEX publication_tasks_due_queue_idx
        ON publication_tasks (tenant_id, status, next_attempt_at, created_at, id);
    `
  },
  {
    version: 28,
    name: "knowledge_url_import_previews",
    sql: `
      CREATE TABLE knowledge_url_import_previews (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        library_id TEXT NOT NULL REFERENCES knowledge_libraries(id) ON DELETE CASCADE,
        requested_url TEXT NOT NULL,
        final_url TEXT NOT NULL,
        title TEXT NOT NULL,
        content_text TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        content_type TEXT NOT NULL,
        source_bytes INTEGER NOT NULL CHECK (source_bytes >= 0),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'committing', 'committed', 'expired')),
        document_id TEXT REFERENCES knowledge_documents(id) ON DELETE SET NULL,
        version_id TEXT REFERENCES knowledge_document_versions(id) ON DELETE SET NULL,
        idempotency_key TEXT NOT NULL DEFAULT '',
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        committed_at TEXT,
        UNIQUE (workspace_id, created_by, idempotency_key)
      ) STRICT;

      CREATE INDEX knowledge_url_previews_expiry_idx
        ON knowledge_url_import_previews (workspace_id, status, expires_at);
      CREATE INDEX knowledge_url_previews_hash_idx
        ON knowledge_url_import_previews (library_id, content_hash, status);
    `
  }
]);

function positiveInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

export function resolveDatabasePath(options = {}) {
  const configured = String(options.databasePath || process.env.TZ_DATABASE_PATH || "").trim();
  return path.resolve(configured || path.join(moduleRoot, "data", "tongzhuo-production.sqlite"));
}

export class ProductionDatabase {
  constructor(options = {}) {
    this.databasePath = resolveDatabasePath(options);
    this.busyTimeoutMs = positiveInteger(options.busyTimeoutMs ?? process.env.TZ_DATABASE_BUSY_TIMEOUT_MS, 5000, 100, 60_000);
    mkdirSync(path.dirname(this.databasePath), { recursive: true });
    this.connection = new DatabaseSync(this.databasePath);
    this.closed = false;
    this.configure();
    if (options.runMigrations !== false) this.migrate();
    try {
      chmodSync(this.databasePath, 0o600);
    } catch {
      // POSIX permissions are a best-effort safeguard; Windows deployments must set an explicit ACL.
    }
  }

  configure() {
    this.connection.exec(`PRAGMA busy_timeout = ${this.busyTimeoutMs}`);
    this.connection.exec("PRAGMA foreign_keys = ON");
    this.connection.exec("PRAGMA journal_mode = WAL");
    this.connection.exec("PRAGMA synchronous = NORMAL");
    const pragmas = this.pragmas();
    if (pragmas.foreignKeys !== 1) throw new Error("SQLite foreign_keys could not be enabled.");
    if (pragmas.journalMode !== "wal") throw new Error(`SQLite WAL mode could not be enabled (actual: ${pragmas.journalMode}).`);
  }

  pragmas() {
    const journalMode = this.connection.prepare("PRAGMA journal_mode").get()?.journal_mode;
    const foreignKeys = this.connection.prepare("PRAGMA foreign_keys").get()?.foreign_keys;
    const busyTimeout = this.connection.prepare("PRAGMA busy_timeout").get()?.timeout;
    return {
      journalMode: String(journalMode || "").toLowerCase(),
      foreignKeys: Number(foreignKeys || 0),
      busyTimeoutMs: Number(busyTimeout || 0)
    };
  }

  migrate() {
    this.connection.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      ) STRICT;
    `);
    const applied = this.connection.prepare("SELECT 1 FROM migrations WHERE version = ?");
    const record = this.connection.prepare("INSERT INTO migrations (version, name, applied_at) VALUES (?, ?, ?)");
    for (const migration of MIGRATIONS) {
      if (applied.get(migration.version)) continue;
      this.transaction(() => {
        // Another process may finish this migration while this connection is
        // waiting for the IMMEDIATE write lock during a first boot. Recheck
        // under that lock before executing non-idempotent CREATE/ALTER SQL.
        if (applied.get(migration.version)) return;
        this.connection.exec(migration.sql);
        record.run(migration.version, migration.name, new Date().toISOString());
      });
    }
  }

  transaction(callback, mode = "IMMEDIATE") {
    if (typeof callback !== "function") throw new TypeError("transaction callback must be a function.");
    const normalizedMode = String(mode || "IMMEDIATE").toUpperCase();
    if (!["DEFERRED", "IMMEDIATE", "EXCLUSIVE"].includes(normalizedMode)) throw new TypeError("Unsupported SQLite transaction mode.");
    this.connection.exec(`BEGIN ${normalizedMode}`);
    try {
      const result = callback(this.connection);
      if (result && typeof result.then === "function") throw new TypeError("ProductionDatabase transactions must be synchronous.");
      this.connection.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        this.connection.exec("ROLLBACK");
      } catch {
        // Keep the original transaction error.
      }
      throw error;
    }
  }

  checkpoint(mode = "PASSIVE") {
    const normalized = String(mode || "PASSIVE").toUpperCase();
    if (!["PASSIVE", "FULL", "RESTART", "TRUNCATE"].includes(normalized)) throw new TypeError("Unsupported WAL checkpoint mode.");
    return this.connection.prepare(`PRAGMA wal_checkpoint(${normalized})`).get();
  }

  close() {
    if (this.closed) return;
    this.connection.close();
    this.closed = true;
  }
}

export function openProductionDatabase(options = {}) {
  return new ProductionDatabase(options);
}

export { MIGRATIONS };

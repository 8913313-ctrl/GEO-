# GEO Method Integration Contract

This contract defines how Tongzhuo GEO Growth Suite absorbs the GEORank/Yao methodology without copying another admin system.

## Product Boundary

Tongzhuo keeps GEOFlow/Laravel as the main backend. GEORank-compatible services stay behind `GeoEngineManager` as an engine layer. The admin experience, CMS, articles, FAQ, distribution, leads, customer projects, and delivery packages remain in Tongzhuo.

## Method Loop

```text
customer_assets -> fact_base -> question_map -> evidence_content -> website_and_distribution -> ai_sampling -> attribution -> question_map
```

## Required Method Layers

### 1. Fact Base

The knowledge base must become a verified fact base:

- company entity, services, products, customers, cases, qualifications
- source, updated_at, confidence level
- confirmed / pending / forbidden wording
- fact cards reusable by articles, FAQ, pages, and prompts

### 2. Question Map

`TongzhuoGeoOpportunity` must evolve from a single question record into an AI-search intent unit:

- question cluster
- parent question and follow-up chain
- query rewrites
- evidence query
- mapped page / article / FAQ
- competitor and platform adaptation
- current coverage status

### 3. Evidence Content

Articles and FAQ are evidence pages, not generic marketing copy. Content quality gates:

- direct answer in the opening section
- 3 to 5 facts, numbers, cases, or source-backed claims
- comparison module
- operating steps
- FAQ/follow-up questions
- source and updated date
- applicable boundary and limitations
- unverified claims cannot be written as facts

### 4. Real AI Sampling

Local content coverage is only the first phase. The engine contract must later record real platform samples:

```text
platform, surface, prompt_id, run_id, model_version, sampled_at,
mention, recommendation, rank, citations, competitor_mentions, answer_accuracy
```

### 5. Dual Scoring

Do not call a website technical score an AI recommendation score. GEO scoring splits into:

- asset quality score: page structure, Schema, fact accuracy, evidence density, citation readiness
- AI performance score: mention rate, recommendation rate, citation recall, citation accuracy, competitor gap

### 6. Evidence-Bound 90-Day Plan

The 90-day plan must be evidence-bound:

- Day 1-30: fact base, public AI entrypoints, question map, baseline sampling
- Day 31-60: core pages, evidence articles, FAQ, cases, external sources
- Day 61-90: multi-platform resampling, citation analysis, conversion attribution, competitor comparison

Each plan item must have:

```text
evidence_source -> current_question -> owner -> deliverable -> acceptance_metric -> resample_date
```

## Implementation Priority

1. Keep GEOFlow as the product backend.
2. Keep `GeoEngineManager` as the only GEO engine abstraction.
3. Upgrade current modules with fact base, question map, evidence content gates, repeated sampling, and attribution.
4. Use GEORank only as an optional enhanced engine, never as a second customer-facing backend.

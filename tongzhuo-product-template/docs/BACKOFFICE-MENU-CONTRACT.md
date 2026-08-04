# Backoffice Menu Contract

This contract defines the stable backend layout for Tongzhuo GEO Growth Suite.

## Purpose

The backoffice is one product surface, not several unrelated admin panels. It must let operators edit the website, manage facts and content, run GEO work, dispatch distribution jobs, review customer assets, and control system access from one left-hand navigation.

## Menu Groups

- overview
- website_cms
- content_growth
- geo_operations
- distribution_execution
- customer_assets
- system

## Core Modules

- fact_base
- question_map
- evidence_content
- ai_sampling
- geo_console
- publisher_assistant
- contact_leads
- customer_projects

## Workflow

1. Overview shows operating status and next actions.
2. Website CMS manages editable pages, FAQ, navigation, and AI entrypoints.
3. Content growth maintains the fact base and evidence articles.
4. GEO operations runs diagnosis, question mapping, sampling, and plans.
5. Distribution execution dispatches jobs and writes back platform results.
6. Customer assets collect leads and customer project records.
7. System separates configuration, API token, and role control.

## Boundaries

- Website content is public and AI-readable.
- GEO and content are separated but linked.
- Platform login stays local.
- The server does not store platform passwords.
- The customer handoff requires an operations bundle.


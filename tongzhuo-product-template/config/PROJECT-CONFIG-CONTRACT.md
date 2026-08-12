# Customer project configuration contract

This file defines the product-level configuration boundary for one independently deployed customer GEO project.

## Canonical fields

- `project.slug`, `project.name`, and `tenant_id` identify the project. Do not introduce `customerId`, `client_id`, or another tenant synonym.
- `product_capability` is `geo` for this product. It describes the shared GEO capability and is not an industry name.
- `industry_template` selects an adaptation pack such as `professional-services`, `building-materials`, or `machinery`. The pack supplies terminology, default questions, and content types; it never contains customer facts.
- `company_profile` contains the customer's factual public identity.
- `brand` contains customer-owned visual identity references.
- `site` contains the customer's public website settings.
- `contact` contains public contact and response expectations.
- `integrations` contains deploy-time service connections. Secrets and API tokens are injected after deployment and must remain empty in the template.
- `methodology` references versioned GEO core method and prompt assets. It does not embed prompt text in customer configuration.

## Compatibility window

The `customer_slug`, `company`, `website`, `geoflow`, `publisher_assistant`, and `desktop_agent` blocks remain in the example during the P2 migration because existing delivery scripts still read them. They are compatibility aliases, not a second identity model. A later task will make the validators and delivery scripts read the canonical fields first, then remove the aliases after the migration tests pass.

## Isolation rules

Every project-owned record, generated asset, content item, lead, task, and monitoring result must be scoped by `tenant_id`. A project configuration may reference global GEO methodology assets and one industry adaptation, but it must never include another customer's facts, credentials, cookies, browser profiles, or database.

## Runtime industry-template contract

The executable registry lives in `tongzhuo-geo-platform-demo/industry-templates/`. Every registered template uses the same fields: `templateKey`, `displayName`, `requiredFields`, `defaultQuestionGroups`, `contentTypes`, `terminologyPack`, `promptPreset`, and `navigationPreset`. Run `npm run check:industry-templates` in the platform directory after adding or changing a template.

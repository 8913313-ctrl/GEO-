# GEOFlow workbench port

Production access:

- Public website and existing GEOFlow entry: `https://www.example.com/`
- Dedicated workbench entry: `https://www.example.com/`

The dedicated port maps to the same web container. Its root path redirects to
`/geo_admin/dashboard`, while the existing port keeps its current behavior.

The production compose file needs this additional web port mapping:

```yaml
ports:
  - "${WEB_PORT:-18080}:80"
  - "${WORKBENCH_PORT:-18180}:80"
```


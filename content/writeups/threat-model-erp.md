# Campus ERP threat model

Zones: student edge, SSO, application, and the database that actually stores grades.

Priority mitigations:

1. SSO session lifetime shorter than a lab day.
2. Admin actions written to a store the app cannot delete.
3. No shared database account between the portal and the reporting job.

```bash
$ git diff docs/trust-zones.md
```

The diagram stays in the research folder. This note is the decision list.

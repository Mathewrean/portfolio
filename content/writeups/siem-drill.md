# SIEM drill

The Cyber Chief Circle session paired packet capture with alert triage.

```bash
$ sudo journalctl -u wazuh-manager --since "1 hour ago"
$ splunk search 'index=lab sourcetype=wazuh | stats count by rule.groups'
```

I kept three questions for every alert: which host, which identity, and which earlier packet explains it. Arkime was the place to answer the third one.

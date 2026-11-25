# Lame

![Lame badge](assets/images/challenges/lame_badge-ee35f6c6ac70.png)

Legacy SMB on a retired box. The useful part of the lab was the order of operations, not a single magic command.

## Recon

```bash
$ nmap -sC -sV -p- TARGET
$ enum4linux -a TARGET
```

The scan output is what I keep in the note. Service versions go in the evidence section, not in the chat log.

## Shares

```bash
$ smbclient -L //TARGET -N
$ smbclient //TARGET/tmp -N
```

Anonymous listing was enough to see the writable share. I copied only what the objective asked for, then wrote the detection idea: alert on unexpected SMB writes against hosts that should not expose `tmp`.

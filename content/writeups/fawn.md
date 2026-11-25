# Fawn

FTP was the only interesting port.

```bash
$ nmap -sV -p 21 TARGET
$ ftp TARGET
ftp> anonymous
ftp> ls
ftp> get flag.txt
```

Anonymous login returned the objective file. Hardening note: disable anonymous FTP, or do not leave flags in the FTP root of a routed lab.

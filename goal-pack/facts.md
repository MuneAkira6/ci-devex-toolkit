# Fact table — ci-devex-toolkit

Form: the fact entry of spec-driven-dev-playbook (`templates/fact-entry.md`). One fact per entry, with
the date, the command, its output as printed, what follows from it and the decisions that depend on it.
A fact is measured again before a decision depends on it. When a measurement overturns an entry, the
entry stays as it was and a "Superseded" box is added under it.

F1–F17 were measured by the author while preparing this pack, on 2026-10-01: on **the host** (the
Linux machine that runs the implementation) unless the entry says **the author's Windows PC**. The run
appends its own measurements from F18 on. In the outputs, paths under the account's home directory are
shown as `~` and temporary directories as `<tmp>`; nothing else is changed. Where an output is long, the
entry says which lines it keeps.

### F1: The host is Ubuntu 20.04.6 with 12 CPUs, 46 GiB and Docker 28.1.1 on overlay2

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the author, on the host
- Commands:

```
nproc; free -g | sed -n 2p; df -h $HOME | tail -n 1
docker info --format '{{.ServerVersion}} / {{.OperatingSystem}} / {{.NCPU}} CPU / storage {{.Driver}}'
```

- Output:

```
12
Mem:             46           1           3           0          42          44
/dev/sdb2       916G  146G  724G  17% /
28.1.1 / Ubuntu 20.04.6 LTS / 12 CPU / storage overlay2
```

- What follows: the machine description for devcontainer-io-ab's results on this host. Docker is
  root-equivalent here (the account is in the `docker` group), which is why the goal brief limits what
  the run may do with it.
- Decisions that depend on it: the Docker red line; the machine line of the A/B results.

### F2: Node v24.19.0; pnpm 11.28.0 is selected by `packageManager`; this skeleton installs in 1.8 s with no build script

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the author, on the host, in a scratch copy of this repository's skeleton
- Commands:

```
node --version
pnpm --version            # outside any project
pnpm install              # in the scratch copy; last lines kept
```

- Output:

```
v24.19.0
11.22.0
dependencies:
+ spdx-expression-parse 5.0.0
+ spdx-license-list 6.12.0
+ yaml 2.9.1

devDependencies:
+ @biomejs/biome 2.5.14
+ @types/node 24.19.0 (26.6.3 is available)
+ @types/spdx-expression-parse 4.0.0
+ pnpm 11.28.0
+ typescript 7.0.2
+ vitest 5.0.2

Done in 1.8s using pnpm v11.28.0
```

- What follows: the global pnpm is 11.22.0 and switches itself to 11.28.0 inside the repository;
  nothing needs corepack, and corepack is not enabled on this host. No dependency asks for a build
  script, so `allowBuilds` stays empty. In the same scratch copy, `tsc --noEmit` rejected an `enum`
  with `TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.`, Biome checked the
  tool directories and skipped `oss-inventory/samples`, and a Vitest test ran.
- Decisions that depend on it: the given `package.json`, `tsconfig.json` and `biome.json`; red line 8.

### F3: bash 5.0.17, git 2.25.1, gawk 5.0.1 as `awk` and mawk 1.3.4; git 2.25 has no `git init -b`

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the author, on the host
- Commands:

```
bash --version | head -n 1; git --version; readlink -f "$(command -v awk)"; awk --version 2>&1 | head -n 1; command -v mawk && mawk -W version 2>&1 | head -n 1
git init -b main '<tmp>/x' 2>&1 | head -n 2
git -c init.defaultBranch=main init -q --bare '<tmp>/a.git' && echo bare-ok; git --git-dir='<tmp>/a.git' symbolic-ref HEAD
comm --version | head -n 1; sha256sum --version | head -n 1; mktemp --version | head -n 1; timeout --version | head -n 1
```

- Output:

```
GNU bash, version 5.0.17(1)-release (x86_64-pc-linux-gnu)
git version 2.25.1
/usr/bin/gawk
GNU Awk 5.0.1, API: 2.0 (GNU MPFR 4.0.2, GNU MP 6.2.0)
/usr/bin/mawk
mawk 1.3.4 20200120
error: unknown switch `b'
usage: git init [-q | --quiet] [--bare] [--template=<template-directory>] [--shared[=<permissions>]] [<directory>]
bare-ok
refs/heads/master
comm (GNU coreutils) 8.30
sha256sum (GNU coreutils) 8.30
mktemp (GNU coreutils) 8.30
timeout (GNU coreutils) 8.30
```

- What follows: the shell tool must work with git 2.25 (no `init -b`; `init.defaultBranch` is
  silently ignored and the branch is `master`) as well as with the newer git of Git Bash and of
  ubuntu-24.04. Both awks are present, so the self-test can be run with mawk forced first on `PATH`.
- Decisions that depend on it: the portability rules of two-repos-one-worktree (SCOPE.md).

### F4: No ripgrep, ShellCheck, actionlint or Java on the host's PATH; ripgrep 15.2.0 is provided for the run

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the author, on the host
- Commands:

```
for c in rg shellcheck actionlint git java docker; do printf '%s: %s\n' "$c" "$(command -v "$c" || echo 'not found')"; done
# provisioning, by the author: the release tarball and its .sha256 from github.com/BurntSushi/ripgrep
( cd <tmp> && sha256sum -c ripgrep-15.2.0-x86_64-unknown-linux-musl.tar.gz.sha256 )
PATH="$HOME/portfolio-runs/bin:$PATH" rg --version | head -n 1
```

- Output:

```
rg: not found
shellcheck: not found
actionlint: not found
git: /usr/bin/git
java: not found
docker: /usr/bin/docker
ripgrep-15.2.0-x86_64-unknown-linux-musl.tar.gz: OK
ripgrep 15.2.0 (rev e89fff89ac)
```

- What follows: `rg` is on the run's `PATH` from `~/portfolio-runs/bin` (a directory of this run, not
  a system install); ShellCheck and actionlint run from their pinned images (F5); there is no JVM, so
  the run does not produce sbt or Gradle reports (F12).
- Decisions that depend on it: the search check of two-repos-one-worktree; `pnpm shellcheck` and
  `pnpm actionlint`; the JVM fixtures being given.

### F5: The images the run may use are present, with these digests

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the author, on the host (each pulled once while this pack was prepared)
- Commands:

```
for i in node:24.19.0-bookworm-slim ubuntu/squid:6.6-24.04_edge rhysd/actionlint:latest koalaman/shellcheck:stable alpine:latest; do
  printf '%-32s %s\n' "$i" "$(docker image inspect --format '{{index .RepoDigests 0}} {{.Size}}' "$i")"; done
docker run --rm node:24.19.0-bookworm-slim sh -c 'node --version; npm --version; command -v curl || echo no-curl; command -v openssl || echo no-openssl'
docker run --rm --entrypoint squid ubuntu/squid:6.6-24.04_edge -v | head -n 1
docker image inspect --format '{{json .Config.Entrypoint}} {{json .Config.Cmd}} {{json .Config.User}}' ubuntu/squid:6.6-24.04_edge
docker run --rm rhysd/actionlint:latest -version | head -n 1
docker run --rm koalaman/shellcheck:stable --version | sed -n 2p
```

- Output:

```
node:24.19.0-bookworm-slim       node@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df 229081435
ubuntu/squid:6.6-24.04_edge      ubuntu/squid@sha256:8a3baed477e2c282ab8aa5edad442f69873246964f225c5c2ae8364b6610963c 205771866
rhysd/actionlint:latest          rhysd/actionlint@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667 72405430
koalaman/shellcheck:stable       koalaman/shellcheck@sha256:bb596a0d169b85ddd81d8b6d3a2ff6d5baf5fca10b97f575ebc647c3dff62b3d 16213136
alpine:latest                    alpine@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b 8415579
v24.19.0
11.17.0
no-curl
no-openssl
Squid Cache: Version 6.14
["entrypoint.sh"] ["-f","/etc/squid/squid.conf","-NYC"] ""
1.7.12
version: 0.11.0
```

- What follows: every image is referenced by digest in this repository, so nothing is pulled during the
  run. The Node image has neither curl nor openssl: probes inside it use Node. The squid image starts as
  root and reads `/etc/squid/squid.conf`; it has `sed`.
- Decisions that depend on it: SCOPE.md, "Images"; the Docker red line.

### F6: Ports 18440–18449 are free

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the author, on the host
- Commands:

```
ss -ltnH | awk '{print $4}' | sed 's/.*://' | sort -un | tr '\n' ' '
ss -ltnH | awk '{print $4}' | sed 's/.*://' | awk '$1>=18440 && $1<=18449' | wc -l
```

- Output:

```
22 53 139 445 631 3128 3350 3389
0
```

- What follows: the relay test publishes on 18441 and 18442; nothing else of the run listens on the
  host. The other listeners belong to other users of this machine and are not touched.
- Decisions that depend on it: SCOPE.md, "Ports".

### F7: Containers on this host get no proxy settings, and direct egress fails TLS

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the author, on the host
- Commands:

```
docker run --rm --entrypoint sh mongo:7 -c 'env | grep -ic _proxy'
curl -sS --noproxy '*' -m 8 -o /dev/null -w 'http %{http_code}\n' https://repo1.maven.org/maven2/
curl -sS -m 20 -o /dev/null -w 'http %{http_code} verify %{ssl_verify_result}\n' https://repo1.maven.org/maven2/
```

- Output:

```
0
curl: (60) SSL certificate problem: self signed certificate in certificate chain
http 000
http 200 verify 0
```

- What follows: from inside a container, the internet is not reachable in any useful way, and the
  proxy's credentials are not the run's to hand to a container. So no container of this run uses the
  network: the A/B runs with `--network none`, and the relay test talks only to local mock services.
- Decisions that depend on it: the A/B recipe (F13); the relay test's design; the JVM fixtures being
  given (F12).

### F8: `pnpm licenses list --json --prod` (pnpm 11.28.0) groups packages by license string; `--filter` selects a workspace package

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the author, on the host: in a scratch project (first two commands) and in a scratch copy
  of this repository's skeleton (last two)
- Commands:

```
pnpm licenses list --json --prod > lic.json; jq -c 'to_entries[] | {license: .key, n: (.value|length)}' lic.json
jq '.[keys[0]][0] | with_entries(if .key=="paths" then .value |= map(sub("^/tmp/[^/]+"; "<tmp>")) else . end)' lic.json
pnpm --filter acme-tasks-web licenses list --json --prod | jq -c 'to_entries[] | {license: .key, names: [.value[] | "\(.name)@\(.versions | join(","))"]}'
pnpm --filter ci-devex-toolkit licenses list --json --prod | jq -c 'to_entries[] | {license: .key, names: [.value[] | "\(.name)@\(.versions | join(","))"]}'
```

- Output:

```
{"license":"ISC","n":2}
{"license":"CC0-1.0","n":1}
{
  "name": "spdx-license-list",
  "versions": [
    "6.12.0"
  ],
  "paths": [
    "<tmp>/p/node_modules/.pnpm/spdx-license-list@6.12.0/node_modules/spdx-license-list"
  ],
  "license": "CC0-1.0",
  "author": "Sindre Sorhus",
  "homepage": "https://github.com/sindresorhus/spdx-license-list#readme",
  "description": "List of SPDX licenses"
}
{"license":"MIT","names":["call-bind-apply-helpers@1.0.2","call-bound@1.0.4","dunder-proto@1.0.1","es-define-property@1.0.1","es-errors@1.3.0","es-object-atoms@1.1.2","function-bind@1.1.2","get-intrinsic@1.3.0","get-proto@1.0.1","gopd@1.2.0","has-symbols@1.1.0","hasown@2.0.4","math-intrinsics@1.1.0","object-inspect@1.13.4","react@19.3.0","react-dom@19.3.0","scheduler@0.28.0","side-channel@1.1.1","side-channel-list@1.0.1","side-channel-map@1.0.1","side-channel-weakmap@1.0.2"]}
{"license":"BSD-3-Clause","names":["qs@6.16.0"]}
{"license":"Apache-2.0","names":["rxjs@7.8.2"]}
{"license":"0BSD","names":["tslib@2.8.1"]}
{"license":"ISC","names":["yaml@2.9.1"]}
{"license":"CC-BY-3.0","names":["spdx-exceptions@2.5.0"]}
{"license":"MIT","names":["spdx-expression-parse@5.0.0"]}
{"license":"CC0-1.0","names":["spdx-license-ids@3.0.24","spdx-license-list@6.12.0"]}
{"license":"ISC","names":["yaml@2.9.1"]}
```

- What follows: an entry carries `name`, `versions`, `paths` (absolute, into `node_modules`), `license`
  and optional `author`, `homepage` and `description`; one entry can list several versions. In a
  workspace, select the package with `--filter <name>`: in a scratch workspace, the same command at the
  root without `--filter` printed something `jq` could not parse (`parse error: Invalid numeric
  literal at line 1, column 3`). Absolute paths contain the machine's home directory, so a committed
  copy of this output must not keep them.
- Decisions that depend on it: the pnpm parser; the committed pnpm fixture; the self-inventory.

### F9: spdx-license-list 6.12.0 (CC0-1.0) carries the full text of 727 licenses; spdx-expression-parse 5.0.0 parses expressions

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the author, on the host
- Commands:

```
npm view spdx-license-list version license time.modified --json
node -e "const l=require('spdx-license-list/full'); console.log(Object.keys(l).length, typeof l['Apache-2.0'].licenseText, l['Apache-2.0'].licenseText.length, l.MIT.licenseText.split('\n')[0])"
node -e "import('spdx-expression-parse').then(m => console.log(JSON.stringify((m.default ?? m)('(MIT OR Apache-2.0) AND BSD-3-Clause'))))"
```

- Output:

```
{
  "version": "6.12.0",
  "license": "CC0-1.0",
  "time.modified": "2026-07-24T13:16:11.549Z"
}
727 string 10279 MIT License
{"left":{"left":{"license":"MIT"},"conjunction":"or","right":{"license":"Apache-2.0"}},"conjunction":"and","right":{"license":"BSD-3-Clause"}}
```

- What follows: the license texts come from this package, not from the network and not from files
  written by hand. Expressions are parsed, not split on spaces.
- Decisions that depend on it: SCOPE.md, oss-inventory "Texts" and "Normalization".

### F10: The jk1 Gradle plugin keeps only the first license of a module unless its JSON renderer is told otherwise

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the author, on the host, in throwaway containers (how the network was reached: F12)
- Commands (the sample is `oss-inventory/samples/gradle-app`; the first run used the renderer's default
  `JsonReportRenderer("index.json")`, the second the committed `JsonReportRenderer("index.json", false)`;
  the two reports are `oss-inventory/fixtures/gradle-single` and `oss-inventory/fixtures/gradle`, and the
  `jq` and `find` commands were run again on those committed copies, in `oss-inventory/fixtures`):

```
gradle --no-daemon -q generateLicenseReport
jq -c '.dependencies[] | select(.moduleName | test("logback-classic|h2database|jspecify|aopalliance")) | {m: .moduleName, l: .moduleLicense}' gradle-single/index.json
jq -c '.dependencies[] | select(.moduleName | test("logback-classic|h2database|jspecify|aopalliance")) | {m: .moduleName, l: [.moduleLicenses[] | .moduleLicense], u: [.moduleLicenses[] | .moduleLicenseUrl]}' gradle/index.json
find gradle -type f | sort
```

- Output:

```
{"m":"aopalliance:aopalliance","l":"Public Domain"}
{"m":"ch.qos.logback:logback-classic","l":"LGPL-2.1-only"}
{"m":"com.h2database:h2","l":"MPL 2.0"}
{"m":"org.jspecify:jspecify","l":"The Apache License, Version 2.0"}
{"m":"aopalliance:aopalliance","l":["Public Domain"],"u":[""]}
{"m":"ch.qos.logback:logback-classic","l":["EPL-2.0","LGPL-2.1-only"],"u":["https://www.eclipse.org/legal/epl-v20.html","https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html"]}
{"m":"com.h2database:h2","l":[null,"EPL 1.0","MPL 2.0"],"u":["https://h2database.com/html/license.html","https://opensource.org/licenses/eclipse-1.0.php","https://www.mozilla.org/en-US/MPL/2.0/"]}
{"m":"org.jspecify:jspecify","l":[null,"The Apache License, Version 2.0"],"u":["https://www.apache.org/licenses/LICENSE-2.0","http://www.apache.org/licenses/LICENSE-2.0.txt"]}
gradle/failureaccess-1.0.3.jar/META-INF/LICENSE
gradle/guava-33.7.2-jre.jar/META-INF/LICENSE
gradle/index.json
gradle/jackson-annotations-2.22.jar/META-INF/LICENSE
gradle/jackson-annotations-2.22.jar/META-INF/NOTICE
gradle/jackson-core-2.22.3.jar/META-INF/LICENSE
gradle/jackson-core-2.22.3.jar/META-INF/NOTICE
gradle/jackson-databind-2.22.3.jar/META-INF/LICENSE
gradle/jackson-databind-2.22.3.jar/META-INF/NOTICE
gradle/slf4j-api-2.0.20.jar/META-INF/LICENSE.txt
```

- What follows: with the default renderer, logback's EPL-2.0 and two of H2's three entries disappear
  without a word, so the sample uses `false` and the tool must refuse the single-license shape rather
  than read it. In the multi-license shape a license entry can have a `null` name and only a URL. The
  plugin also copies the license files that jars ship (6 of the 15 modules) into directories named
  `<artifact>-<version>.jar/META-INF/`; one of them (`slf4j-api-2.0.20.jar/META-INF/LICENSE.txt`) has
  CRLF line ends. The same 15 modules spell the Apache license five ways: `Apache License, Version
  2.0`, `The Apache Software License, Version 2.0`, `Apache 2.0`, `The Apache License, Version 2.0`, and
  a null name with an Apache URL.
- Decisions that depend on it: `oss-inventory/fixtures/gradle` (multi) and `fixtures/gradle-single`
  (default); the Gradle parser; the overrides for H2 and aopalliance.

### F11: sbt-license-report 1.10.0 writes one license per dependency

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the author, on the host, in a throwaway container (network: F12)
- Commands (the sample is `oss-inventory/samples/sbt-app`):

```
sbt -batch dumpLicenseReport
cat target/license-reports/acme-tasks-api-licenses.csv
```

- Output:

```
Category,License,Dependency,Notes
Apache,Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0),com.typesafe # config # 1.4.9 (https://github.com/lightbend/config),
Apache,Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0),org.scala-lang # scala-library # 3.8.4 (https://scala-lang.org/),
Apache,Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0),org.scala-lang # scala3-library_3 # 3.8.4 (https://scala-lang.org/),
BSD,BSD-2-Clause (https://jdbc.postgresql.org/about/license.html),org.postgresql # postgresql # 42.7.13 (https://jdbc.postgresql.org),
LGPL,LGPL-2.1-only (https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html),ch.qos.logback # logback-classic # 1.6.5,
LGPL,LGPL-2.1-only (https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html),ch.qos.logback # logback-core # 1.6.5,
MIT,MIT (https://spdx.org/licenses/MIT.html),com.lihaoyi # geny_3 # 1.1.1 (https://github.com/com-lihaoyi/geny),
MIT,MIT (https://opensource.org/license/mit),org.slf4j # slf4j-api # 2.0.19 (http://www.slf4j.org),
MIT,MIT (https://opensource.org/licenses/MIT),org.typelevel # cats-core_3 # 2.13.0 (https://typelevel.org/cats),
MIT,MIT (https://opensource.org/licenses/MIT),org.typelevel # cats-kernel_3 # 2.13.0 (https://typelevel.org/cats),
MIT,MIT License (https://spdx.org/licenses/MIT.html),com.lihaoyi # ujson_3 # 4.4.3 (https://github.com/lihaoyi/upickle),
MIT,MIT License (https://spdx.org/licenses/MIT.html),com.lihaoyi # upack_3 # 4.4.3 (https://github.com/lihaoyi/upickle),
MIT,MIT License (https://spdx.org/licenses/MIT.html),com.lihaoyi # upickle-core_3 # 4.4.3 (https://github.com/lihaoyi/upickle),
MIT,MIT License (https://spdx.org/licenses/MIT.html),com.lihaoyi # upickle-implicits_3 # 4.4.3 (https://github.com/lihaoyi/upickle),
MIT,MIT License (https://spdx.org/licenses/MIT.html),com.lihaoyi # upickle_3 # 4.4.3 (https://github.com/lihaoyi/upickle),
MIT,The MIT License (https://opensource.org/licenses/MIT),org.checkerframework # checker-qual # 3.55.1 (https://checkerframework.org/),
```

- What follows: logback is dual-licensed (F10 shows EPL-2.0 and LGPL-2.1-only for the same artifact
  and version), and this report shows only LGPL-2.1-only; the CSV cannot say what it dropped. The tool
  reads what the CSV says and the README states the limit. The license cell is `<name> (<url>)`; the
  dependency cell is `<group> # <artifact> # <version>`, with ` (<url>)` when the module has a home
  page; every line ends with an empty Notes cell.
- Decisions that depend on it: the sbt parser; README, 「制約・既知の限界」.

### F12: On this host, sbt cannot use the authenticated proxy by itself; both JVM reports were produced through a relay

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the author, on the host. The proxy's credentials were written only into files of a 0700
  directory and never printed; they are not part of this repository.
- Commands, first attempt (credentials in Gradle's `gradle.properties`, and in the standard JVM proxy
  properties for sbt):

```
docker run --rm ... gradle:9.8.0-jdk21 gradle --no-daemon -q generateLicenseReport
docker run --rm --env-file <0600 file with JAVA_TOOL_OPTIONS=-Dhttps.proxyUser=... -Dhttps.proxyPassword=...> ... sbtscala/scala-sbt:eclipse-temurin-21.0.12_8_1.13.0_3.8.4 sbt -batch dumpLicenseReport
```

- Output (the sbt error lines kept):

```
  exit 0, 21 s
[error]   download error: Caught java.io.IOException (Unable to tunnel through proxy. Proxy returns "HTTP/1.1 407 Proxy Authentication Required") while downloading https://repo1.maven.org/maven2/com/github/sbt/sbt-license-report_2.12_1.0/1.10.0/sbt-license-report-1.10.0.pom
  exit 1, 5 s
```

- Commands, second attempt: a squid container (`ubuntu/squid:6.6-24.04_edge`) on a private Docker
  network, holding the upstream credentials in its configuration; both JVMs pointed at it with
  `-Dhttp(s).proxyHost=<relay> -Dhttp(s).proxyPort=3128` and no credentials.
- Output (the relay's access log reduced to result codes):

```
sbt:    [success] Total time: 3 s, completed Oct 1, 2026, 6:46:58 AM   (exit 0, 9 s)
gradle: exit 0, 17 s
relay:  16 TCP_TUNNEL/200 CONNECT
images: gradle@sha256:3bad8c6f194befc7a1a9d4a6452aed83bdbb5a6d6f6752e5b0acbfeec52961b9 (Gradle 9.8.0, JVM 21.0.12.1)
        sbtscala/scala-sbt@sha256:eafe9c4c5934377cdf98e4ac6fe4f4b5d7e7dea6377fc9bc423a66c20adbdca0 (sbt 1.13.0, Java 21.0.12)
```

- What follows: Gradle answers a 407 with credentials from its own properties; sbt's dependency
  resolver does not, and needs a proxy that asks for nothing — a relay that adds the credentials. That
  is the reason for pr-compile-check's relay, observed here first-hand. The run has no JVM (F4) and must
  not handle the proxy's credentials, so the sbt and Gradle reports are given as fixtures
  (`oss-inventory/fixtures/PROVENANCE.md`), and the CI regenerates them on GitHub's runners, where no
  proxy exists.
- Decisions that depend on it: the given fixtures; the CI job that regenerates them; the relay's
  rationale in the README.

### F13: The A/B recipe works on this host with no network inside the containers; on Linux the two arms measure the same

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the author, on the host, with a 300-module version of the sample on TypeScript 7
- Commands (the sequence the harness automates; the failures first):

```
pnpm install --lockfile-only                           # in the sample, on the host
pnpm fetch --store-dir <tmp>/store --cache-dir <tmp>/cache
npm pack pnpm@11.28.0                                  # in the probe; the harness takes pnpm from node_modules instead
docker build -q --network none -t ci-probe-ioab:local .   # FROM node:24.19.0-bookworm-slim, pnpm from the tarball
docker run --rm --network none ... pnpm install --offline --frozen-lockfile --store-dir /store
docker run --rm --network none ... pnpm install --offline --frozen-lockfile --store-dir /store   # store only, no metadata cache
docker run --rm --network none -e CI=true ... pnpm install --offline --frozen-lockfile --store-dir /store --cache-dir /cache
```

- Output (kept lines; the three JSON lines of each arm are put on one line):

```
fetch 7 s; store 62M, 2116 files
11.28.0
[ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY] Aborted removal of modules directory due to no TTY
✗ Lockfile failed supply-chain policy check (98 entries in 94ms)
[ERR_PNPM_NO_OFFLINE_META] Failed to resolve @types/express-serve-static-core in package mirror /root/.cache/pnpm/v11/metadata-full/https%3A+registry.npmjs.org/@types/express-serve-static-core.jsonl
-- round 1 bind:   {"phase":"install","ms":1923,"files":1279} {"phase":"build","ms":123,"files":301} {"phase":"first-request","ms":147}
-- round 1 volume: {"phase":"install","ms":1827,"files":1279} {"phase":"build","ms":122,"files":301} {"phase":"first-request","ms":178}
-- round 2 bind:   {"phase":"install","ms":1819,"files":1279} {"phase":"build","ms":116,"files":301} {"phase":"first-request","ms":185}
-- round 2 volume: {"phase":"install","ms":1887,"files":1279} {"phase":"build","ms":119,"files":301} {"phase":"first-request","ms":177}
```

- What follows: three conditions make an offline install work: `CI=true` (pnpm otherwise asks before
  purging `node_modules` and aborts without a TTY), the store, and the **metadata cache** filled by the
  same `pnpm fetch` (the supply-chain check reads publish dates offline from it). On Linux a bind mount
  is the native filesystem, so the arms come out within noise of each other: that is expected, and it
  is a result, not a failure. Files written into a bind mount by a container belong to root on the host
  and are removed through a container.
- Decisions that depend on it: SCOPE.md, devcontainer-io-ab; README, 「結果」 and 「制約」.

> **Superseded in part, 2026-10-01 (the implementation run, G4 — F26).** The entry's text stays as
> it was. Measured with this repository's own harness, 5 runs per arm at 1,000 modules on
> TypeScript 6.0.3, the `build` and `first-request` phases do come out within noise (ratios 0.98
> and 1.00), but `install` does **not**: the bind arm is consistently the faster of the two
> (medians 876 ms against 1067 ms, ratio 0.82, with the two ranges not overlapping). F13's
> conclusion — that moving these four directories onto named volumes buys nothing on Linux —
> stands and is if anything stronger; the words "within noise" are too weak for the install phase.
> F13's own numbers were a 300-module probe on TypeScript 7, not this harness's output.

### F14: On Windows (Docker Desktop) the arms differ, and three traps appear that Linux never shows

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the author, on **the author's Windows PC**: Windows 11, Docker Desktop 28.5.1 (14 CPUs
  and 16 GiB for its VM), Git Bash; the same recipe as F13, with the sample in the user's temporary
  directory on `C:`
- Commands and output, in the order they happened (kept lines; in (b) and (c) one line per arm and
  round, printed by the probe script as shown):

```
# (a) store filled on Windows without supportedArchitectures, TypeScript 7
{"phase":"install","ms":12358,"files":1165}            # bind arm
Error: Unable to resolve @typescript/typescript-linux-x64. Either your platform is unsupported, or you are missing the package on disk.

# (b) with supportedArchitectures (os linux, cpu x64, libc glibc), TypeScript 7, three rounds
-- round 1 bind   [ERR_PNPM_EACCES] [importPackage /w/node_modules/@typescript/typescript-linux-x64] EACCES: permission denied, rename '/w/node_modules/@typescript/typescript-linux-x64_tmp_10_8' -> '/w/node_modules/@typescript/typescript-linux-x64'
-- round 1 volume install=1580ms (1279 files) build=739ms first-request=312ms
-- round 2 bind   [ERR_PNPM_EACCES] ... rename '/w/node_modules/@typescript/typescript-linux-x64_tmp_10_10' -> ...
-- round 2 volume install=1488ms (1279 files) build=637ms first-request=263ms
-- round 3 bind   [ERR_PNPM_EACCES] ... rename '/w/node_modules/@typescript/typescript-linux-x64_tmp_11_5' -> ...
-- round 3 volume install=1563ms (1279 files) build=649ms first-request=263ms

# (c) the same with TypeScript 6.0.3 (JavaScript, no native binary), three rounds
-- round 1 bind   install=5998ms (889 files) build=4767ms first-request=4997ms
-- round 1 volume install=1505ms (889 files) build=2209ms first-request=267ms
-- round 2 bind   install=4976ms (889 files) build=4983ms first-request=4221ms
-- round 2 volume install=1641ms (889 files) build=2024ms first-request=254ms
-- round 3 bind   install=6954ms (889 files) build=7080ms first-request=4087ms
-- round 3 volume install=2356ms (889 files) build=2532ms first-request=257ms
```

- And one trap of the probe itself: with `MSYS_NO_PATHCONV=1` exported in Git Bash, pnpm (a Windows
  program) read `--store-dir /tmp/...` as `C:\tmp\...`, so the store went elsewhere and the containers
  got an empty one; without the variable, Git Bash rewrites `docker -v /path:/w` arguments instead.
- What follows:
  - A store filled on Windows lacks the linux packages unless the sample's `supportedArchitectures`
    names them (it does now).
  - With TypeScript 7's native compiler, the bind arm failed every time on renaming the directory of
    the freshly written binary, while the volume arm did not: a failure mode of bind mounts on this
    machine, worth reporting, but it leaves nothing to compare. The sample therefore uses TypeScript
    6.0.3, which is JavaScript.
  - The harness must be a Node program that builds paths and spawns `docker` itself, never a shell
    script that passes POSIX paths to Windows programs.
  - These are the author's preliminary numbers from a probe script (300 modules), not results of this
    repository's harness, and the README does not quote them as such. The author runs the harness on
    this PC after the run.
- Decisions that depend on it: the given `devcontainer-io-ab/sample/package.json` and
  `pnpm-workspace.yaml`; the harness being Node; README, 「制約」.

### F15: The GitHub Actions the workflows may use, resolved to commits

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the author, from the Windows PC, with GitHub's REST API (`/releases/latest`, then
  `/git/ref/tags/<tag>`, dereferencing annotated tags)
- Output:

```
actions/checkout           v7.0.1   3d3c42e5aac5ba805825da76410c181273ba90b1 (commit)
actions/setup-node         v7.0.0   820762786026740c76f36085b0efc47a31fe5020 (commit)
pnpm/action-setup          v6.1.0   ea17c68df8912ef543352723c149a84f56e3d413 (tag)
actions/setup-java         v6.0.1   de7274f081f381c8f8158605e0321c36c376e2e6 (commit)
gradle/actions             v6.4.0   3f5f9adaf7d9fecd50b5935e54106014257a94e6 (tag)
sbt/setup-sbt              v1.5.11  6158cb0903b8ceeae04f830055f3155e1b6a5ad7 (tag)
actions/upload-artifact    v7.0.1   043fb46d1a93c77aae656e7c1c64a875d1fc6a0a (commit)
```

- What follows: every `uses:` in this repository's workflows is one of these SHAs with the version as a
  comment. The run cannot reach GitHub; it does not look up or change them.
- Decisions that depend on it: the workflow rule "pinned by SHA" (SCOPE.md); `.github/workflows/ci.yml`.

### F16: TypeScript 7.0.2 is the native compiler; 6.0.3 is the last JavaScript one

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the author, from the Windows PC
- Commands:

```
npm view typescript dist-tags --json
npm view typescript@6 version --json | tail -n 3
```

- Output:

```
{
  "dev": "3.9.4",
  "tag-for-publishing-older-releases": "4.1.6",
  "insiders": "4.6.2-insiders.20220225",
  "beta": "6.0.0-beta",
  "rc": "7.0.1-rc",
  "latest": "7.0.2",
  "next": "7.1.0-dev.20260930.4"
}
  "6.0.2",
  "6.0.3"
]
```

- What follows: the toolkit itself uses TypeScript 7 (`tsc --noEmit`); the measured sample pins 6.0.3
  (F14).
- Decisions that depend on it: the given sample `package.json`.

### F17: The sources of the two sample overrides

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the author, from the Windows PC
- Commands:

```
curl -sS https://repo1.maven.org/maven2/aopalliance/aopalliance/1.0/aopalliance-1.0.pom | sed -n '/<licenses>/,/<\/licenses>/p'
curl -sS https://h2database.com/html/license.html | sed 's/<[^>]*>//g' | grep -i -m 5 'dual\|MPL\|EPL'
```

- Output:

```
  <licenses>
    <license>
      <name>Public Domain</name>
    </license>
  </licenses>
Copyright 2004-2026 H2 Group. Multiple-Licensed under the MPL 2.0,
and the EPL 1.0 (https://h2database.com/html/license.html).
H2 is dual licensed and available under the MPL 2.0 (Mozilla Public License Version 2.0)
or under the EPL 1.0  (Eclipse Public License).
There is a license FAQ for both the MPL and the EPL.
```

- What follows: the two rulings in `oss-inventory/samples/overrides.yml` rest on these pages.
- Decisions that depend on it: `oss-inventory/samples/overrides.yml`.

### F18: The run's own toolchain re-measurement in G0 confirms F2–F6, F10 and F11; `jq` 1.6 is on the host and Biome covers three files so far

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the implementation run (G0), on the host, in this repository
- Commands:

```
node --version; pnpm --version; bash --version | head -n 1; git --version
readlink -f "$(command -v awk)"; awk --version 2>&1 | head -n 1; command -v mawk; mawk -W version 2>&1 | head -n 1
rg --version | head -n 1; docker version --format '{{.Server.Version}}'; jq --version
jq '.dependencies | length' oss-inventory/fixtures/gradle/index.json oss-inventory/fixtures/gradle-single/index.json
awk 'NR>1 && NF' oss-inventory/fixtures/sbt/acme-tasks-api-licenses.csv | wc -l
find oss-inventory/fixtures/gradle -type f | wc -l
( cd oss-inventory/fixtures && sha256sum gradle/index.json gradle-single/index.json sbt/acme-tasks-api-licenses.csv )
./node_modules/.bin/biome check --verbose . 2>&1 | sed -n '/Files processed/,/Files fixed/p'
```

- Output:

```
v24.19.0
11.28.0
GNU bash, version 5.0.17(1)-release (x86_64-pc-linux-gnu)
git version 2.25.1
/usr/bin/gawk
GNU Awk 5.0.1, API: 2.0 (GNU MPFR 4.0.2, GNU MP 6.2.0)
/usr/bin/mawk
mawk 1.3.4 20200120
ripgrep 15.2.0 (rev e89fff89ac)
28.1.1
jq-1.6
15
15
16
10
6f2d879fbba3355106942bdd8c7030d585524c210ccd244550a8daa2d479fcbe  gradle/index.json
83dfca8699bb5355c637b6bd124bbefbc230993f4eac1c218d6d0a0017de0b50  gradle-single/index.json
44952c7b1a81260bf57c3e4a70f2574bf33d3367f1015762702a9760e200d160  sbt/acme-tasks-api-licenses.csv
  i Files processed:
  - biome.json
  - oss-inventory/test/fixtures.test.ts
  - vitest.config.ts
  i Files fixed:
```

- What follows: nothing in F2–F6 has moved, so the contract's toolchain assumptions hold for the run.
  Inside the repository `pnpm --version` answers `11.28.0`, as F2 predicted for `packageManager`; the
  twelve fixture checksums equal those in `oss-inventory/fixtures/PROVENANCE.md` byte for byte, so the
  G1 parsers may be written against exactly these bytes. Two tools not named in F1–F17 are also usable:
  `jq` 1.6, which the run uses to read fixtures from the shell (never from the tool's own code), and
  Biome, whose `files.includes` currently resolves to three files because the tool directories of
  G1–G4 do not exist yet — the count grows as they are added, which makes it a useful coverage check
  rather than a constant.
- Decisions that depend on it: that G0 freezes the contract unchanged (no "Contract changes" entry);
  the fixture-based tests of G1; using `jq` in the shell only.

### F19: The fixtures force exactly eight name aliases and one URL alias, and exactly two dependencies stay UNKNOWN

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the implementation run (G1), on the host, from the committed fixtures
- Commands (the first three list every distinct declared name and every null-name entry; the fourth
  asks spdx-license-list which of those names is already an SPDX id; the last runs the finished tool
  over all three reports with no overrides):

```
jq -r '[.dependencies[].moduleLicenses[].moduleLicense] | unique | .[] | tostring' oss-inventory/fixtures/gradle/index.json
awk -F'(' 'NR>1 {print $1}' oss-inventory/fixtures/sbt/acme-tasks-api-licenses.csv | cut -d, -f2 | sed 's/ *$//' | sort -u
jq -r '.dependencies[] | . as $d | .moduleLicenses[] | select(.moduleLicense == null) | "\($d.moduleName) \(.moduleLicenseUrl)"' oss-inventory/fixtures/gradle/index.json
node -e "import('spdx-license-list/full.js').then(m => { const ids = Object.keys(m.default); for (const n of process.argv.slice(1)) console.log(ids.some(i => i.toLowerCase() === n.toLowerCase()), JSON.stringify(n)) })" <each name above>
pnpm inventory -- --pnpm oss-inventory/fixtures/pnpm/acme-tasks-web.json --pnpm-root . --sbt oss-inventory/fixtures/sbt/acme-tasks-api-licenses.csv --gradle oss-inventory/fixtures/gradle/index.json --out <tmp>/f-noov
```

- Output (the first three as printed; the fourth's answers are summarised in the two lines marked
  `spdx:`; the last command's stdout filtered to the lines about counts and failures):

```
null
Apache 2.0
Apache License, Version 2.0
EPL 1.0
EPL-2.0
LGPL-2.1-only
MIT
MPL 2.0
Public Domain
The Apache License, Version 2.0
The Apache Software License, Version 2.0

Apache-2.0
BSD-2-Clause
LGPL-2.1-only
MIT
MIT License
The MIT License

com.h2database:h2 https://h2database.com/html/license.html
org.jspecify:jspecify https://www.apache.org/licenses/LICENSE-2.0

spdx: true  for Apache-2.0, BSD-2-Clause, EPL-2.0, LGPL-2.1-only, MIT
spdx: false for Apache 2.0, "Apache License, Version 2.0", EPL 1.0, MPL 2.0,
            "The Apache License, Version 2.0", "The Apache Software License, Version 2.0",
            MIT License, The MIT License, Public Domain

UNKNOWN: 2
56 dependencies
UNKNOWN gradle:aopalliance:aopalliance@1.0: no SPDX id for "Public Domain"
UNKNOWN gradle:com.h2database:h2@2.5.252: no SPDX id for "(https://h2database.com/html/license.html)"
2 failure(s)
```

- What follows: nine declared names are not SPDX ids. Eight of them denote exactly one license and
  one version and become aliases; the ninth, `Public Domain`, does not — a public-domain dedication
  has no SPDX id at all — so aopalliance stays UNKNOWN and is decided by the human ruling of F17.
  Of the two null-name entries, only jspecify's Apache URL becomes a URL alias; H2's URL points at a
  dual-license page, which is a reading rather than a spelling, so H2 stays UNKNOWN too — and it
  stays UNKNOWN although its other two entries map, which is the rule of F10 made visible. Both
  `https://www.apache.org/licenses/LICENSE-2.0` and `.../LICENSE-2.0.txt` occur in the Gradle
  fixture and are two different keys under SCOPE.md's comparison rule, so only the first is in the
  table.
- Decisions that depend on it: the content of `oss-inventory/aliases.yml` (8 names, 1 URL and
  nothing else); the two sample overrides staying necessary; PROGRESS.md AC-4.

### F20: The pnpm sample resolves to 25 production packages under five license strings, each shipping one license file

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the implementation run (G1), on the host, after `pnpm install`
- Commands:

```
pnpm --filter acme-tasks-web licenses list --json --prod > <tmp>/live.json
jq -r 'to_entries[] | "\(.key): \([.value[] | .versions[]] | length)"' <tmp>/live.json | sort
jq '[.[][]] | length' <tmp>/live.json; jq '[.[][].paths[]] | length' <tmp>/live.json
jq -r '.[][] | .paths[]' <tmp>/live.json | while read -r p; do find "$p" -maxdepth 1 -type f \( -name 'LICENSE*' -o -name 'LICENCE*' -o -name 'COPYING*' -o -name 'NOTICE*' \) -printf '%f\n'; done | sort | uniq -c
```

- Output:

```
0BSD: 1
Apache-2.0: 1
BSD-3-Clause: 1
ISC: 1
MIT: 21
25
25
     22 LICENSE
      1 LICENSE.md
      2 LICENSE.txt
```

- What follows: the sample has 25 production dependencies, one version and one path each, so the
  one-row-per-name-and-version rule gives 25 rows and no path has to be matched to a version here.
  All five license strings are SPDX ids, so the sample exercises step 1 of the normalisation and
  never reaches the alias table. Each of the 25 packages ships exactly one license file, which is
  why the full sample run's `notices/pnpm/` holds 25 files beside the 9 under `notices/gradle/`.
  A copy of this report with the 25 absolute paths made relative to the repository root is committed
  as `oss-inventory/fixtures/pnpm/acme-tasks-web.json`; with the paths blanked out on both sides the
  committed file and the live one are identical, so nothing but the paths was changed.
- Decisions that depend on it: the committed pnpm fixture; PROGRESS.md AC-3 and AC-7.

### F21: A whitelist `info/exclude` hides a nested asset path from git unless its parent directories are negated too

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the implementation run (G2), on the host, in a throwaway product repository whose
  path contains a space
- Commands (one bare assets repository over a product working tree that holds a top-level
  `assets/a.md` and a nested `docs/assets/n.md`; the first `info/exclude` is the whitelist exactly as
  SCOPE.md words it, the second adds the parent lines):

```
printf '/*\n!/assets/\n!/docs/assets/\n!/.ignore\n' > "$G/info/exclude"
git --git-dir="$G" --work-tree="$P" status --porcelain
git --git-dir="$G" --work-tree="$P" add -A && git --git-dir="$G" --work-tree="$P" ls-files
rm -f "$G/index"
printf '/*\n!/assets/\n!/docs/\n/docs/*\n!/docs/assets/\n!/.ignore\n' > "$G/info/exclude"
git --git-dir="$G" --work-tree="$P" add -A && git --git-dir="$G" --work-tree="$P" ls-files
```

- Output:

```
?? assets/
assets/a.md

assets/a.md
docs/assets/n.md
```

- What follows: `/*` excludes `docs` itself, and git never descends into an excluded directory, so
  `!/docs/assets/` is never reached: with the whitelist as worded, the nested asset is invisible to
  `git status` and `git add`, silently. Negating each parent directory and re-excluding its other
  contents (`!/docs/`, then `/docs/*`) makes git descend and the leaf negation apply. The same shape
  was then checked on a two-level path (`!/a/`, `/a/*`, `!/a/b/`, `/a/b/*`, `!/a/b/c/` → tracked
  `a/b/c/deep.md`), on two paths sharing one parent (`docs/assets/` and `docs/specs/`, both tracked),
  on a file rather than a directory (`docs/NOTES.md`, tracked) and on a path with spaces in both
  components (`my docs/my assets/with space.md`, tracked).
- Decisions that depend on it: `assets init` writes the parent lines into the assets repository's
  `info/exclude`; the reading recorded under the G2 heading of PROGRESS.md.

### F22: ripgrep hides what `.git/info/exclude` hides, and a root `.ignore` brings it back — `.ignore` itself only if it negates itself

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the implementation run (G2), on the host, in the same product repository
- Commands (`rg` 15.2.0 from the run's PATH, F4; the product's exclude block hides the two asset
  paths and `.ignore`):

```
printf '/assets/\n/docs/assets/\n/.ignore\n' > .git/info/exclude
rm -f .ignore;                                              rg --files --hidden | sort
printf '!/assets/\n!/docs/assets/\n'          > .ignore;    rg --files --hidden | sort
printf '!/assets/\n!/docs/assets/\n!/.ignore\n' > .ignore;  rg --files --hidden | sort
```

- Output (the lines that change; `.git/**`, `src/app.txt` and the other files are listed in all
  three runs and are left out here):

```
# no .ignore
docs/NOTES.md
docs/specs/s.md

# .ignore negating the two asset paths
assets/a.md
docs/assets/n.md
docs/NOTES.md
docs/specs/s.md

# .ignore also negating itself
.ignore
assets/a.md
docs/assets/n.md
docs/NOTES.md
docs/specs/s.md
```

- What follows: this is the reason `.ignore` exists at all — without it the assets disappear from
  search without a word. Unlike git's own whitelist (F21), ripgrep needs no parent negation here,
  because the product's exclude block names the asset paths directly instead of excluding
  everything with `/*`. And because the product's block also hides `/.ignore`, the file is itself
  invisible to `rg` unless the block in `.ignore` negates `/.ignore` as well — which check 3 of
  SCOPE.md ("every file the assets repository tracks is listed by `rg --files --hidden`") requires,
  since `.ignore` belongs to the assets repository and is tracked by it.
- Decisions that depend on it: `assets init` writes `!/.ignore` into the `.ignore` block; `assets
  check`'s search check; the reading recorded under the G2 heading of PROGRESS.md.

### F23: git octal-quotes a path outside ASCII while ripgrep prints it raw, so `assets check` failed on a correct layout

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the implementation run (G3), on the host, in a throwaway product repository, after
  the goal bus reported the defect
- Commands (one asset path, `docs/assets/`, holding an ASCII file and a Japanese one; the assets
  are committed and the layout is otherwise the one `assets check` passes on):

```
assets ls-files
rg --files --hidden | grep -v '^\.git/'
assets check; echo "exit=$?"
printf 'wip\n' > 'docs/assets/未追跡.md'; assets check; echo "exit=$?"
# after the fix: every ls-files and status --porcelain the script runs is `git -c core.quotePath=false …`
assets check; echo "exit=$?"
```

- Output:

```
.ignore
docs/assets/spec.md
"docs/assets/\346\227\245\346\234\254\350\252\236 \344\273\225\346\247\230.md"

.ignore
src/app.txt
docs/assets/spec.md
docs/assets/日本語 仕様.md

hidden-from-search: "docs/assets/\346\227\245\346\234\254\350\252\236 \344\273\225\346\247\230.md" is tracked by the assets repository but rg --files --hidden does not list it
check failed: 1 violation(s)
exit=1

hidden-from-search: "docs/assets/\346\227\245\346\234\254\350\252\236 \344\273\225\346\247\230.md" is tracked by the assets repository but rg --files --hidden does not list it
stray-status: the assets repository's status shows the product path "docs/assets/\346\234\252\350\277\275\350\267\241.md"
check failed: 2 violation(s)
exit=1

check passed: 1 asset path(s), 0 violations
exit=0
```

- What follows: with git's default `core.quotePath=true`, `ls-files` and `status --porcelain` print
  a path outside ASCII octal-escaped and wrapped in quotes, while `rg --files --hidden` prints the
  bytes on disk. `assets check` compares the two lists line by line with `comm`, so every
  non-ASCII asset looked missing from the search, and every non-ASCII path under an asset path
  looked like a stray product path: two false violations on a layout that was correct. Running
  every `ls-files` and `status --porcelain` through `git -c core.quotePath=false` makes both sides
  print the same bytes and the check passes. The passthrough is left alone: `assets ls-files` is
  git, and still quotes, which is what the user would get from git itself. A path holding a
  literal quote or a newline is still quoted by git; SCOPE.md's portability clause promises spaces,
  and this limit belongs in the README's 「制約・既知の限界」.
- Decisions that depend on it: the `product_git`/`assets_git` helpers in `two-repos-one-worktree/assets`;
  the self-test case `check passes when an asset file has a name outside ASCII`.

### F24: squid drops to the user `proxy` and cannot write to /dev/stdout; the image's entrypoint tails /var/log/squid instead

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the implementation run (G3), on the host, in the relay test's own Compose project
- Commands (the first configuration used `access_log stdio:/dev/stdout squid` and
  `cache_log stdio:/dev/stderr`, which is the usual way to get a container's logs onto stdout):

```
pnpm relay:test                      # with access_log on /dev/stdout; the relay never came up
docker run --rm --network none --entrypoint sh <squid digest> -c 'cat "$(command -v entrypoint.sh)"'
pnpm relay:test                      # with access_log on /var/log/squid/access.log
```

- Output:

```
relay-1 | 2026/10/01 10:26:40| FATAL: Cannot open '/dev/stdout' for writing.
relay-1 | 	The parent directory must be writeable by the
relay-1 | 	user 'proxy', which is the cache_effective_user
relay-1 | 	set in squid.conf.
relay-1 | 2026/10/01 10:26:40| Squid Cache (Version 6.14): Terminated abnormally.

tail -F /var/log/squid/access.log 2>/dev/null &
tail -F /var/log/squid/error.log 2>/dev/null &
tail -F /var/log/squid/store.log 2>/dev/null &
tail -F /var/log/squid/cache.log 2>/dev/null &
/usr/sbin/squid -Nz
/usr/sbin/squid "$@"

7 passed, 0 failed
```

- What follows: the squid image starts as root (F5) but squid itself drops to `cache_effective_user
  proxy` before opening its logs, so the `/dev/stdout` trick fails. The image's own entrypoint
  already tails the four files under `/var/log/squid/` to the container's stdout, so
  `squid.conf.template` logs there and `docker compose logs` shows the access log anyway. The same
  paths are the standard ones on a Debian or Ubuntu machine, so the template is not
  container-specific.
- Decisions that depend on it: `access_log stdio:/var/log/squid/access.log squid` and
  `cache_log /var/log/squid/cache.log` in `pr-compile-check/relay/squid.conf.template`; AC-23's
  count of the password in `docker compose logs` being meaningful at all.

### F25: through the relay the whole chain works, and with the wrong upstream password the client gets the 407 F12 is about

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the implementation run (G3), on the host, `pnpm relay:test`, twice in a row
- Commands:

```
pnpm relay:test                      # the project is ci-devex-relay-test; credentials per run
docker ps --filter name=<host-squid> --format '{{.Names}} {{.Status}} {{.Ports}}'
ss -ltnH | awk '{print $4}' | sed 's/.*://' | awk '$1>=18440 && $1<=18449' | wc -l
```

- Output (the run's seven lines; the second run gave the same seven with different random values):

```
ok   http through the relay reaches the origin, authenticated at the upstream: status 200, body "mock origin: the relay reached me\n", 2 forwarded line(s) with credentialsMatched true
ok   CONNECT through the relay opens a tunnel to the echo, authenticated at the upstream: HTTP/1.1 200 Connection established, echoed "tunnel-d331a1810ea0", 1 tunnelled line(s) with credentialsMatched true
ok   a request straight to the upstream without credentials gets 407: status 407
ok   the relay is published on 127.0.0.1 only: docker compose port -> 127.0.0.1:18441; ss -ltn -> LISTEN  0        4096           127.0.0.1:18441          0.0.0.0:*
ok   no credential appears in the containers’ logs: 0 occurrence(s)
ok   no container of the run has a proxy variable in its environment: none in relay, mock-upstream, mock-origin
ok   control: with the wrong upstream credentials the request does not succeed: status 407, 2 rejection(s) logged with credentialsMatched false

7 passed, 0 failed

<host-squid> Up 3 weeks 127.0.0.1:3128->3128/tcp
0
```

- What follows: the relay built from the template's own files forwards both an absolute-URI request
  and a `CONNECT` to the parent with the parent's credentials, and the client needs none. The
  control shows what happens when the relay's own credentials are wrong: the upstream answers 407
  and squid passes it down to the client, which is exactly the situation F12 describes for sbt —
  a client that cannot answer a 407 simply stops there. The two mocks' logs name no credential at
  all, and no container of the run has a proxy variable in its environment. The host's other squid,
  `<host-squid>` on 3128, is not the run's and was not touched; after the run no port in
  18440-18449 is listening.
- Decisions that depend on it: the relay's design as SCOPE.md describes it; README 「結果」; the
  runbook's section on the relay.

### F26: On this Linux host the bind arm is the faster one for `install`, and the two arms are equal for `build` and `first-request`

- Measured on: 2026-10-01 / last re-measured: 2026-10-01
- Measured by: the implementation run (G4), on the host, with this repository's harness
- Commands (two full measurements, the second into a temporary directory; one Docker-using command
  at a time, neither backgrounded):

```
pnpm ioab                                   # 5 runs per arm, 1000 modules, into devcontainer-io-ab/results
pnpm ioab -- --out <tmp>/second             # the same, a second time
```

- Output (the summary of each; the twenty per-run JSON lines are in the two results files):

```
# first measurement, committed as results/2026-10-01-linux-x64.json
| install       | bind   |  876 |  870 |  894 | 5 |
| install       | volume | 1067 | 1038 | 1103 | 5 |
| build         | bind   | 1063 | 1060 | 1064 | 5 |
| build         | volume | 1083 | 1057 | 1102 | 5 |
| first-request | bind   |  222 |  221 |  243 | 5 |
| first-request | volume |  223 |  222 |  240 | 5 |
ratios bind ÷ volume: install 0.82, build 0.98, first-request 1

# second measurement, into a temporary directory
| install       | bind   |  884 |  875 |  899 | 5 |
| install       | volume | 1066 | 1057 | 1166 | 5 |
| build         | bind   | 1066 | 1036 | 1095 | 5 |
| build         | volume | 1067 | 1039 | 1100 | 5 |
| first-request | bind   |  222 |  221 |  242 | 5 |
| first-request | volume |  223 |  222 |  245 | 5 |
ratios bind ÷ volume: install 0.83, build 1, first-request 1

machine: Linux 5.4.0-216-generic (x64), 12 × Intel(R) Xeon(R) E-2146G CPU @ 3.50GHz, 46.9 GiB,
         Docker 28.1.1 on Ubuntu 20.04.6 LTS, storage driver overlay2
files: 891 under node_modules, 1003 under dist; body "modules=1000 total=5010524" every time
wall clock: 58 s per full measurement
```

- What follows: on Linux there is nothing for named volumes to win, and for the install phase there
  is something to lose. `build` and `first-request` are the same to within a few milliseconds
  (ratios 0.98 to 1.00), while `install` is about 190 ms — 18 per cent — slower on the named volume
  in both measurements, with the bind and volume ranges not overlapping in either. **The cause is
  not measured and is not guessed at.** This refines F13's "within noise" (see the Superseded box
  under it) without changing its conclusion: the practice's move to named volumes was a Windows
  answer to a Windows cost (F14), and this host cannot show that cost.

- **Corrected on 2026-10-01 by the run that wrote this entry**, after the goal bus checked the
  premise of an earlier sentence. That sentence read "a bind mount on this host is the native
  filesystem and the volume adds a layer that the install, which writes 891 files, pays for". The
  premise does not hold here, and the measurement that shows it is:

  ```
  docker info --format 'DockerRootDir={{.DockerRootDir}} Driver={{.Driver}}'
  df -h /var/lib/docker .
  ```

  ```
  DockerRootDir=/var/lib/docker Driver=overlay2
  Filesystem      Size  Used Avail Use% Mounted on
  /dev/sdb2       916G  148G  721G  18% /
  /dev/sdb2       916G  148G  721G  18% /
  ```

  A local named volume on this host is a directory under `/var/lib/docker/volumes`, on the same
  device `/dev/sdb2` as the bind-mounted repository — there is no extra layer to pay for. The
  explanation is withdrawn; the numbers stand. Nothing in the README may offer a mechanism either.
- Decisions that depend on it: `devcontainer-io-ab/results/2026-10-01-linux-x64.{json,md}`; the
  README's 「結果」 and 「制約・既知の限界」, which must say what was measured rather than repeat
  "the arms do not differ"; PROGRESS.md AC-29 and AC-30.

---

F27–F30 were measured by the author on 2026-10-02, after the run had answered DONE, while verifying it
on the Windows PC and again on the host. They led to the changes listed under "Changes after the run"
in SCOPE.md.

### F27: Since bash 5.2 an unquoted `&` in a `${var//pattern/replacement}` replacement stands for the match; the squid image's bash is 5.2

- Measured on: 2026-10-02 / last re-measured: 2026-10-02
- Measured by: the author, after the run: in Git Bash on the Windows PC, on the host, and inside the
  pinned squid image
- Commands (`patsub.sh` is the first three lines below; it was run with `bash patsub.sh` in Git Bash,
  with `bash -s` on the host, and with `docker run --rm -i --entrypoint bash ubuntu/squid@sha256:8a3b… -s`):

```
v='a&b$c/d\e*f`g|h'; line='login=u:@P@ end'
q=${line//@P@/"$v"}; u=${line//@P@/$v}
printf 'bash %s | quoted: %s | unquoted: %s\n' "$BASH_VERSION" "$q" "$u"
docker run --rm --entrypoint bash ubuntu/squid@sha256:8a3baed477e2c282ab8aa5edad442f69873246964f225c5c2ae8364b6610963c -c "bash --version | head -n 1; shopt patsub_replacement"
```

- Output:

```
bash 5.2.37(1)-release | quoted: login=u:a&b$c/d\e*f`g|h end | unquoted: login=u:a@P@b$c/d\e*f`g|h end
bash 5.0.17(1)-release | quoted: login=u:a&b$c/d\e*f`g|h end | unquoted: login=u:a&b$c/d\e*f`g|h end
bash 5.2.21(1)-release | quoted: login=u:a&b$c/d\e*f`g|h end | unquoted: login=u:a@P@b$c/d\e*f`g|h end
GNU bash, version 5.2.21(1)-release (x86_64-pc-linux-gnu)
patsub_replacement	on
```

- How it was found: under Git Bash, `pnpm test` failed in
  `pr-compile-check/test/render-squid-conf.test.ts` ("takes a password with shell and sed metacharacters
  literally"): the rendered file held ``login=dummy-user:a@UPSTREAM_PASSWORD@b$c/d\e*f`g|h``. On the host
  the same test passes, because its bash is 5.0.
- The control, on the host: the relay test with passwords that carry an `&` and the render script as
  the run left it (unquoted replacements). Every request through the relay reached the mock upstream
  with the wrong credentials, and the relay never became ready:

```
mock-upstream-1  | {"service":"mock-upstream","event":"request","method":"GET","target":"http://mock-origin/","credentialsMatched":false,"outcome":"407"}
0 passed, 0 failed
(exit 1)
```

  With the replacements quoted, the same test printed `7 passed, 0 failed` twice on the host and once on
  the Windows PC.
- What follows: the render script's comment "a bash replacement takes the value literally" was true
  only of the bash of the host that built it. In the relay container, which runs the script under bash
  5.2, a real password holding an `&` would have been rendered with the placeholder spliced into it, and
  the relay would have failed every request with a 407. The replacements are now quoted, and the relay
  test's passwords carry an `&`, so the case runs under the image's own bash.
- Decisions that depend on it: `pr-compile-check/relay/render-squid-conf.sh`;
  `pr-compile-check/relay/test/run.ts`.

### F28: On Windows, rg prints `\` between path components, and Git Bash rewrites a lone `/` argument

- Measured on: 2026-10-02 / last re-measured: 2026-10-02
- Measured by: the author, after the run, in Git Bash on the Windows PC, with the ripgrep that ships
  with VS Code (`ripgrep 15.0.0 (rev 3a612f88b8)`) put first on `PATH`
- Commands (in a product repository with `src/app.txt` and one asset, `docs/assets/spec.md`):

```
rg --files --hidden | od -c | head -n 3
rg --files --hidden --path-separator /
```

- Output:

```
0000000   .   i   g   n   o   r   e  \n   s   r   c   \   a   p   p   .
0000020   t   x   t  \n   d   o   c   s   \   a   s   s   e   t   s   \
0000040   s   p   e   c   .   m   d  \n   .   g   i   t   \   i   n   d
rg: error parsing flag --path-separator: A path separator must be exactly one byte, but the given separator is 21 bytes: C:/Program Files/Git/
In some shells on Windows '/' is automatically expanded. Use '//' instead.
```

- What follows: `assets check` compares rg's list with git's, and git always writes `/`; so on Windows
  every asset was reported `hidden-from-search` on a correct layout (`pnpm assets:selftest`:
  `8 passed, 3 failed`). The check now runs `rg --files --hidden --path-separator /` with
  `MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'` for that one command, which Git Bash honours and
  everything else ignores. The self-test's third failure was its own: the PATH it used to take rg away,
  `/usr/bin:/bin`, also takes git away in Git Bash (git lives in `/mingw64/bin` there), and on
  ubuntu-24.04 it would keep rg, which apt installs into `/usr/bin`. The self-test now builds a PATH
  without rg from the PATH it runs under. Afterwards: `11 passed, 0 failed` in Git Bash with rg on
  `PATH`; without rg, the two cases that need it fail with `rg is not on PATH, so the search check
  cannot be exercised`, as designed.
- Decisions that depend on it: `two-repos-one-worktree/assets`; `two-repos-one-worktree/test/selftest.sh`.

### F29: Docker Desktop on the Windows PC hands the machine's proxy settings to every container; an explicit empty value overrides them

- Measured on: 2026-10-02 / last re-measured: 2026-10-02
- Measured by: the author, after the run, on the Windows PC (Docker Desktop 28.5.1). The values were
  never printed; only counts.
- Commands:

```
docker run --rm alpine@sha256:28bd… sh -c 'env | grep -ci "_proxy="'
docker run --rm alpine@sha256:28bd… sh -c 'env | grep -i "_proxy=." | wc -l'
docker run --rm -e HTTP_PROXY= -e HTTPS_PROXY= -e NO_PROXY= -e http_proxy= -e https_proxy= -e no_proxy= alpine@sha256:28bd… sh -c 'env | grep -i "_proxy=." | wc -l'
docker compose -p ci-devex-envprobe -f <a file whose service sets the six to ''> run --rm t
```

- Output:

```
6
6
0
0
```

- How it was found: on the Windows PC the relay test printed
  `FAIL no container of the run has a proxy variable in its environment: relay: http_proxy, relay: HTTPS_PROXY, …`
  for all three containers (`6 passed, 1 failed`). The machine's proxy URL carries credentials, so they
  had reached the test's containers. On the host no container gets them (F7), which is why the run saw
  this check pass.
- What follows: every Compose file of the repository (the relay template, the relay test, both A/B
  arms) sets the six variables to empty, and the relay test counts a proxy variable only when it holds
  a value. Afterwards: `ok   no container of the run has a proxy variable in its environment: none in
  relay, mock-upstream, mock-origin`, `7 passed, 0 failed`.
- Decisions that depend on it: the four Compose files; `pr-compile-check/relay/test/run.ts`.

### F30: After the run, the JVM reports regenerated from the committed samples are byte-identical to the fixtures, and the inventory over them exits 0

- Measured on: 2026-10-02 / last re-measured: 2026-10-02
- Measured by: the author, after the run, on the host, through the throwaway relay of F12, from the
  samples exactly as committed
- Commands:

```
gradle --no-daemon -q generateLicenseReport     # in a copy of oss-inventory/samples/gradle-app
sbt -batch dumpLicenseReport                     # in a copy of oss-inventory/samples/sbt-app
sha256sum <the eleven report files>
pnpm inventory -- --gradle <fresh>/gradle/index.json --sbt <fresh>/sbt/acme-tasks-api-licenses.csv --overrides oss-inventory/samples/overrides.yml --texts oss-inventory/samples/texts --out out/inventory-jvm
```

- Output (the checksums of `index.json` and the CSV shown; the other nine match
  `oss-inventory/fixtures/PROVENANCE.md` too):

```
6f2d879fbba3355106942bdd8c7030d585524c210ccd244550a8daa2d479fcbe  ./gradle/index.json
44952c7b1a81260bf57c3e4a70f2574bf33d3367f1015762702a9760e200d160  ./sbt/acme-tasks-api-licenses.csv
Apache-2.0: 13
BSD-2-Clause: 1
EPL-1.0: 1
EPL-2.0: 2
LGPL-2.1-only: 4
LicenseRef-Public-Domain: 1
MIT: 11
MPL-2.0: 1
31 dependencies
(exit 0)
```

- What follows: what the CI's `jvm-reports` job does was done once by hand, with the same result as
  the fixtures. The job itself has still not run; it will on GitHub's runners.
- Decisions that depend on it: README, 「結果」 and 「制約・既知の限界」.

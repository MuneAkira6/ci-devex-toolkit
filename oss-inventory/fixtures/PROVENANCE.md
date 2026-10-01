# Where the fixtures come from

The Gradle and sbt fixtures are real tool output, kept byte for byte (`.gitattributes` marks this
directory `-text`, so not even line ends are touched). They were produced by the author on 2026-10-01,
on a Linux machine (Ubuntu 20.04.6, Docker 28.1.1), from the sample projects in `../samples/`, inside
throwaway containers:

| Tool | Image |
|---|---|
| Gradle 9.8.0 (JVM 21.0.12.1), jk1 dependency-license-report 3.1.4 | `gradle:9.8.0-jdk21@sha256:3bad8c6f194befc7a1a9d4a6452aed83bdbb5a6d6f6752e5b0acbfeec52961b9` |
| sbt 1.13.0 (Java 21.0.12), sbt-license-report 1.10.0 | `sbtscala/scala-sbt:eclipse-temurin-21.0.12_8_1.13.0_3.8.4@sha256:eafe9c4c5934377cdf98e4ac6fe4f4b5d7e7dea6377fc9bc423a66c20adbdca0` |

That machine reaches the internet only through an authenticated proxy. Gradle accepts proxy credentials
in its own properties; sbt's resolver does not (it fails with `Proxy returns "HTTP/1.1 407 Proxy
Authentication Required"`). So both builds went through a relay: a squid container on a private Docker
network that holds the upstream credentials and asks the JVMs for none — the pattern of
`pr-compile-check/relay/`. The measurements are entries F10–F12 of `goal-pack/facts.md`.

## The files

| Fixture | Command (in the sample) | sha256 |
|---|---|---|
| `gradle/index.json` | `gradle --no-daemon -q generateLicenseReport` with `JsonReportRenderer("index.json", false)`, as committed | `6f2d879fbba3355106942bdd8c7030d585524c210ccd244550a8daa2d479fcbe` |
| `gradle/*.jar/META-INF/*` (9 files) | the same run: the plugin copies the license files that jars ship | see below |
| `gradle-single/index.json` | the same build with the renderer's default, `JsonReportRenderer("index.json")`: one license per module | `83dfca8699bb5355c637b6bd124bbefbc230993f4eac1c218d6d0a0017de0b50` |
| `sbt/acme-tasks-api-licenses.csv` | `sbt -batch dumpLicenseReport` (the plugin also writes `.md` and `.html`; only the CSV is kept) | `44952c7b1a81260bf57c3e4a70f2574bf33d3367f1015762702a9760e200d160` |

```
cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30  gradle/failureaccess-1.0.3.jar/META-INF/LICENSE
cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30  gradle/guava-33.7.2-jre.jar/META-INF/LICENSE
cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30  gradle/jackson-annotations-2.22.jar/META-INF/LICENSE
612b14bc77c944ce229cbba0d14919162cfea8ed802cbf06a8e865e032d03201  gradle/jackson-annotations-2.22.jar/META-INF/NOTICE
cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30  gradle/jackson-core-2.22.3.jar/META-INF/LICENSE
e6aef1c0f4cf5b0f802c16b31fce309b3c3737450b93c40d6291bf6540aae3d1  gradle/jackson-core-2.22.3.jar/META-INF/NOTICE
cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30  gradle/jackson-databind-2.22.3.jar/META-INF/LICENSE
612b14bc77c944ce229cbba0d14919162cfea8ed802cbf06a8e865e032d03201  gradle/jackson-databind-2.22.3.jar/META-INF/NOTICE
6632f550c207be8d7d6b5e87f5d7b905bee218d18392d531df457bf60bec1447  gradle/slf4j-api-2.0.20.jar/META-INF/LICENSE.txt
```

The Gradle (multi) and sbt fixtures were produced twice, the second time from the sample files exactly
as committed here, at 16:22 JST; all eleven files came out byte-identical to the first run. The
single-license report was produced once, in an earlier run of the same sample without the `false`, with
the credentials in Gradle's own properties rather than through the relay (F12).

## Regenerating them

Anywhere with a JVM and direct access to Maven Central and the Gradle Plugin Portal:

```
cd oss-inventory/samples/gradle-app && gradle --no-daemon -q generateLicenseReport
cd oss-inventory/samples/sbt-app && sbt -batch dumpLicenseReport
```

The CI does this on every run (`jvm-reports` in `.github/workflows/ci.yml`) and feeds the fresh reports
to the inventory. Newer versions of the dependencies or the plugins can change the output; the fixtures
stay as they are, because the tests are about these bytes.

The pnpm fixture, `pnpm/acme-tasks-web.json`, is produced by the implementation run from
`../samples/pnpm-app` (`pnpm --filter acme-tasks-web licenses list --json --prod`), with its paths made
relative to the repository root.

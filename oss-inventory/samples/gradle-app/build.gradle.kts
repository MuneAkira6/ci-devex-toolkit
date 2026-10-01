// The Gradle sample of oss-inventory: a fictional worker of Acme Tasks with a handful of real
// dependencies. Its only job is to produce a license report: `gradle generateLicenseReport` writes
// build/reports/dependency-license/index.json. The `false` keeps every license a module declares;
// the renderer's default keeps only the first one (goal-pack/facts.md, F10).
import com.github.jk1.license.render.JsonReportRenderer

plugins {
    java
    id("com.github.jk1.dependency-license-report") version "3.1.4"
}

repositories { mavenCentral() }

dependencies {
    implementation("com.google.guava:guava:33.7.2-jre")
    implementation("org.slf4j:slf4j-api:2.0.20")
    implementation("ch.qos.logback:logback-classic:1.6.5")
    implementation("com.fasterxml.jackson.core:jackson-databind:2.22.3")
    implementation("com.h2database:h2:2.5.252")
    implementation("aopalliance:aopalliance:1.0")
}

licenseReport {
    configurations = arrayOf("runtimeClasspath")
    renderers = arrayOf(JsonReportRenderer("index.json", false))
}

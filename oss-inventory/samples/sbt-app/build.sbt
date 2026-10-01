// The sbt sample of oss-inventory: a fictional API of Acme Tasks with a handful of real dependencies.
// Its only job is to produce a license report (see project/plugins.sbt).
ThisBuild / scalaVersion := "3.8.4"

lazy val root = (project in file("."))
  .settings(
    name := "acme-tasks-api",
    libraryDependencies ++= Seq(
      "com.typesafe" % "config" % "1.4.9",
      "org.typelevel" %% "cats-core" % "2.13.0",
      "com.lihaoyi" %% "upickle" % "4.4.3",
      "ch.qos.logback" % "logback-classic" % "1.6.5",
      "org.postgresql" % "postgresql" % "42.7.13"
    )
  )

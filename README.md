# PgMigrations

![npm version](https://badge.fury.io/js/pgmigrations.svg)
![License](https://img.shields.io/badge/license-MIT-green)
![GitHub Stars](https://img.shields.io/github/stars/vb-consulting/pgmigrations?style=social)
![GitHub Forks](https://img.shields.io/github/forks/vb-consulting/pgmigrations?style=social)

Lightweight, Zero-Dependency, PostgreSQL Tool for Node.js and NPM. You can:

- Run Migrations Up or Down (Repeatable, Version, Before or After).
- Run Arbitrary `psql` Commands by using your Project Configuration.
- Create Database Schema Dumps by using your Project Configuration.
- Run PostgreSQL Database Unit Tests in Functions or Procedures.

Use the `pgmigrations` command to manage migrations and run database commands:

```console
> npx pgmigrations --help
Usage:
 pgmigrations [command] [switches]

Commands:
up               Run migrations migrations in order: before, before repeatable, up, repeatable, after. Optional switches: --list, --dry, --full, --dump. 
down             Run only down migrations. Optional switches: --list, --dry, --full, --dump. 
history          console.log the current migration schema history.
run | exec       Run a command or a script file with psql. Command text or a script file is required as the second argument. Any additional arguments will be passed to a psql command. 
dump | schema    Run pg_dump command with --schema-only --encoding=UTF8 swtiches on (plus schemaDumpAdditionalArgs from the config). Any additional arguments will be passed to pg_dump command. 
psql             Run arbitrary psql command or open psql shell. Any additional arguments will be passed to a psql. 
test             Run database tests. 
config           console.log the current configuration. 

Switches:
-h, --help       Show help 
--list           List available migrations in this direction (up or down) or list available database tests. 
--dry            Run in the migrations dry run mode on database in this direction (up or down). No changes will be made to the database (rollbacks changes). 
--full           Executes all migrations in this direction (up or down). Schema history will be ignored.
--dump           Dump the SQL for the migration to the console instead of executing it.
--verbose        Run in verbose mode. This switch applies to all commands. Default is false.

Configurations files:
                 ./db.js from the current dir is the default configuration file. It will be ignored if not found.
--config=[file]  Set the custom config file or multiple files (multiple --config switches). Config files are merged in the order they are provided.
```

Examples:

- Execute a query:
  
```console
> npx pgmigrations run "select * from city" 
```

- Execute a script:
  
```console
> npx pgmigrations run ./script1.sql
```

- List all tables
  
```console
> npx pgmigrations run \dt
```

- Display psql help
  
```console
> npx pgmigrations run --help
```

- Enter the psql interactive mode

```console
> npx pgmigrations psql
```

- Display database schema to console

```console
> npx pgmigrations dump
```

- Write database schema to file

```console
> npx pgmigrations dump --file schema.sql
```

- List all available migrations

```console
> npx pgmigrations up --list
```

- Run all UP migrations

```console
> npx pgmigrations up
```

- Run database tests

```console
> npx pgmigrations test
```

Etc.

Notes:

This tool spawns `psql` or `pg_dump` external processes to execute database commands. That means, that PostgreSQL client tools must be installed on the system to be able to use this package. PostgreSQL client tools are distributed with the default installation so most likely you already have them pre-installed.

If you don't, there is an option to install client tools only:
- On Linux systems, there is a `postgresql-client` package, the apt installation would be then: `$ apt-get install -y postgresql-client` for the latest version.
- On Windows systems, there is an option to install client tools only in the official installer.

The `db` tool from this package will pass your configuration to the PostgreSQL tools to be able to manage the database.

## Migration Naming Convention

### Versioned Migrations

`[prefix][version][separator][description][suffix]`

Versioned migrations run once per version number in order of the versions.

Versioned migrations can be:

1) Version (version up).
2) Undo (version down).

`V001__my_migration.sql`

`U002__undo_my_migration.sql`

- `V` is a prefix for migration up. This version migration. Prefix is configurable.
- `U` is a prefix for migration down. This undo migration. Prefix is configurable.
- `002` is version info or the version number but it can be any text or number.
- `__` is a separator. Separator is configurable.
- `my_migration` and `undo_my_migration` are migration descriptions. This goes to the migration table as the description without underscores.
- `.sql` is the migration suffix. This goes to the migration table as the type with the removed dot and in uppercase.

### Repeatable Migrations

`[prefix][separator][description][suffix]`

Repeatable migrations can be:

1) Repeatable migration: executed only once per file content. This migration will be executed only if the content is changed.
2) Repeatable before: as the normal repeatable, only run before version migration.
3) Before and after migrations. Migrations are executed always regardless of content.

Examples:

`R__my_migration.sql`

`R_before__my_migration.sql`

`after__my_migration.sql`

`after__my_migration.sql`


- `R` is a prefix for repeatable migration. Prefix is configurable.
- `R_before` is a prefix for repeatable before migration. Prefix is configurable.
- `before` is a prefix for before migration. Prefix is configurable.
- `after` is a prefix for before migration. Prefix is configurable.
- `__` is a separator. Separator is configurable.
- `my_migration` and `undo_my_migration` are migration descriptions. This goes to the migration table as the description without underscores.
- `.sql` is the migration suffix. This goes to the migration table as the type with the removed dot and in uppercase.

## Migration Order

1) Before Migrations
2) Repeatable Before Migrations
3) Repeatable Migrations
4) Versioned Migrations
5) After Migrations

## Configuration

The tool will try to read the default configuration file from the running location:  `db.js`. 

Additional configuration files can be loaded with a command line switch `--config=[file]`. They will be loaded and merged in the order they appear, while the default configuration `db.js` is always first (if it exists).

Example of the configuration file:

```js
module.exports = {
    host: "localhost",
    port: "5432",
    dbname: "dvdrental",
    username: "postgres",
    password: "postgres"
}
```

Or, if you already have the `.ENV` file, and prefer to sue that, it can be as simple as:

```js
module.exports = { env: true }
```

Any key in this configuration will override the default values listed below.

### Server Connection

Optional connection parameters such as `host`, `port`, `dbname`, `username` and `passowrd`.

If connection parameters are not set, the PostgreSQL client tools will try to get them from the environment variables, so these parameters can be set in the environment. 

See the [documentation](https://www.postgresql.org/docs/current/libpq-envars.html) for more information.

Alternatively, they can be set from the `.ENV` file, if the `env` option is used.

### Environment

#### psql

Sets the name of the `psql` command executable. The default is `psql`.

If the correct command executable is not in the search path you may have to set the right path manually with this configuration:

- For Linux systems that would be: `/usr/lib/postgresql/{major_version}/bin/psql` 
- For Windows systems that would be: `C:\Program Files\PostgreSQL\{major_version}\bin\psql.exe`

#### pgdump

Sets the name of the `pg_dump` command executable. The default is `pg_dump`.

If the correct command executable is not in the search path you may have to set the right path manually with this configuration:

- For Linux systems that would be: `/usr/lib/postgresql/{major_version}/bin/pg_dump` 
- For Windows systems that would be: `C:\Program Files\PostgreSQL\{major_version}\bin\pg_dump.exe`

#### schemaDumpAdditionalArgs

Additional arguments for the dump schema command that will added by default when dumping the schema. The default value is `["--no-owner", "--no-acl"]` (skip the object owners and the access control list). This value, when set, is expected to be an array of strings.

#### verbose

Set to true to log additional information, including all commands issued to client tools. The default is false. This switch can also be set from the command line.

#### env

Set to true to parse the `.ENV` file and merge it with the configuration.
Set to the string value to specify the file name to be parsed.

The default is false (not used).

All configuration files present in the env file will override values in the configuration. Additional keys for connection properties will also be parsed:
- For the `host` value, additional keys: `pg_host`, `postgres_host`, `pghost`, `postgreshost`, `db_host`, `dbhost`.
- For the `dbname` value, additional keys: `pg_dbname`, `postgres_dbname`, `pgdbname`, `postgresdbname`, `db_name`, `pg_db`, `postgres_db`, `db`, `pg_database`, `postgres_database`, `database`.
- For the `username` value, additional keys: `pg_user`, `postgres_user`, `postgresuser`, `db_user`, `user`, `pg_username`, `postgres_username`, `pgusername`, `postgresusername`, `db_username`, `db_username`.
- For the `password` value, additional keys: `pg_password`, `postgres_password`, `pgpassword`, `postgrespassword`, `db_password`, `pg_pass`, `postgres_pass`, `pg_pass`, `pgpass`, `postgrespass`, `db_pass`, `pass`.

### Migrations

#### migrationDir

Relative directory name where the migration files are located. This value can be a string or array of strings for the multiple directory support.

The default value is not set (empty string). This value needs to be set for every migration project.

#### upDirs

List of directories for versioned UP migrations. Prefix and version number is mandatory.

#### downDirs

List of directories for versioned DOWN migrations. Prefix and version number is mandatory.

#### repetableDirs

List of directories for versioned REPETABLE migrations. Prefix and version number is mandatory.

#### repetableBeforeDirs

List of directories for versioned REPETABLE BEFORE migrations. Prefix and version number is mandatory.

#### beforeDirs

List of directories for versioned BEFORE migrations. Prefix and version number is mandatory.

#### afterDirs

List of directories for versioned AFTER migrations. Prefix and version number is mandatory.

#### keepMigrationDirHistory

Migration scripts are created with a unique name in a temporary directory. Set this value to true to never delete old migration files in a temporary directory. The default value is false, temporary directory is emptied before the start of every migration.

#### upPrefix

Up version migration type prefix. The default is `V` (V for version).

#### downPrefix

Down version migration type prefix. The default is `U` (U for undo).

#### repetablePrefix

Repeatable migration type prefix. The default is `R` (R for repeatable).

#### repetableBeforePrefix

Repeatable before migration type prefix. The default is `R_before` (R for repeatable).

#### beforePrefix

Before migration type prefix. The default is `before`.

#### afterPrefix

The after migration type prefix. The default is `after`.

#### separatorPrefix

Separator prefix. The default value is `__`


#### migrationExtensions: [".sql"],

An array of file extensions that will be considered as the migration file. The default is `[".sql"]`.

#### recursiveDirs

Search recursively trough migration subdirectories. The default is false.

#### tmpDir

Temporary directory for migration scripts. The Default value is your OS temp dir plus  `./___pgmigrations`.

#### historyTableSchema

Schema name for the history table. If this schema doesn't exist, it will be created. The default is `public`.

#### historyTableName

Name of the history table. If this table doesn't exist, it will be created. The default is `schema_history`.

#### hashFunction

Default hash function used for hashing the content. The default value is the `SHA1` function:

```javascript
function(data) {
    const hash = crypto.createHash('sha1');
    hash.update(data);
    return hash.digest('hex');
}
```

#### sortFunction

Default sort function used for sorting migration names. The default value is `(a, b) => a.localeCompare(b, "en")`.

#### versionSortFunction

Default sort function used for sorting migration versions. The default value is `(a, b) => a.localeCompare(b, "en", {numeric: true})`.

### Testing

Test command will run tests on PostgreSQL functions and procedures: 

- Test functions and procedures are required to have no parameters.
- The test is considered passed if:
  - Doesn't raise any exceptions.
  - The function doesn't return either boolean False, or text `f`, or return text doesn't start with `not ok` (case insensitive).

To assert a failed test:
- Raise custom exception with a custom message: `raise exception 'failed message';`
- Return false: `return false;`
- Return text that starts with "not ok": `return 'not ok: failed message'`

#### testFunctionsSchemaContains

Default: `null`

Test function or procedure schema contains this text (case insensitive) or `null` for all non-system schemas.

#### testFunctionsNameContains

Default: `null`

Test function or procedure name contains this text (case insensitive) or `null` for all function or procedure names without parameters.

#### testFunctionsCommentContains

Default: `test`

Test function or procedure comment contains this text (case insensitive) or `null` for all function or procedure names without parameters.

## Contributing

Contributions from the community are welcomed.
Please make a pull request with a description if you wish to contribute.

## License

This project is licensed under the terms of the MIT license.



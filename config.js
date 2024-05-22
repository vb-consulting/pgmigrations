const crypto = require('crypto');

module.exports = {
    host: "",
    port: "",
    dbname: "",
    username: "",
    password: "",
    
    psql: "psql",
    pgdump: "pg_dump",
    schemaDumpAdditionalArgs: ["--no-owner", "--no-acl"],
    verbose: false,
    env: false,

    migrationDir: "",
    
    upDirs: [],
    downDirs: [],
    repetableDirs: [],
    repetableBeforeDirs: [],
    beforeDirs: [],
    afterDirs: [],

    keepMigrationDirHistory: false,
    upPrefix: "V",
    downPrefix: "U",
    repetablePrefix: "R",
    repetableBeforePrefix: "R_before",
    beforePrefix: "before",
    afterPrefix: "after",
    separatorPrefix: "__",

    tmpDir: "./tmp",
    historyTableName: "schema_history",
    historyTableSchema: "public",

    hashFunction: function(data) {
        const hash = crypto.createHash('sha1');
        hash.update(data);
        return hash.digest('hex');
    },
    sortFunction: (a, b) => a.localeCompare(b, "en"),
    versionSortFunction: (a, b) => a.localeCompare(b, "en", {numeric: true}),

    testFunctionsSchemaContains: null,
    testFunctionsNameContains: null,
    testFunctionsCommentContains: "test",
}

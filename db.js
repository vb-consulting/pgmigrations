module.exports = {
    host: "localhost",
    port: "5436",
    dbname: "teamserator",
    username: "postgres",
    password: "postgres",

    migrationDir: "./back/",
    recursiveDirs: true,

    historyTableName: "history",
    historyTableSchema: "sys",
}
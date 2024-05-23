const { warning, info, error, passed, failed } = require("./log.js");
const { query, command } = require("./runner.js");

const testListQuery = `select 
coalesce(json_agg(to_json(sub)), '[]'::json)
from ( 
    select 
        quote_ident(routine_schema) as schema, 
        quote_ident(routine_name) as name, 
        routine_type as type,
        des.description as comment
    from 
        information_schema.routines r
        left join information_schema.parameters p on r.specific_name = p.specific_name and r.specific_schema = p.specific_schema
        join pg_catalog.pg_proc proc on r.specific_name = proc.proname || '_' || proc.oid
        left join pg_catalog.pg_description des on proc.oid = des.objoid
    where
        routine_schema not like 'pg_%'
        and routine_schema <> 'information_schema'
        and not lower(r.external_language) = any(array['c', 'internal'])
        and coalesce(r.type_udt_name, '') <> 'trigger'
        and p.specific_name is null
) sub;`;


module.exports = async function(opt, config) {
    var tests = [];

    var schemaContains = config.testFunctionsSchemaContains ? config.testFunctionsSchemaContains.toLowerCase() : null;
    var nameContains = config.testFunctionsNameContains ? config.testFunctionsNameContains.toLowerCase() : null;
    var commentContains = config.testFunctionsCommentContains ? config.testFunctionsCommentContains.toLowerCase() : null;

    for (const test of JSON.parse(await query(testListQuery, opt, config))) {
        if (!schemaContains && !nameContains && !commentContains) {
            tests.push(test);
        } else {
            if (schemaContains && test.schema && test.schema.toLowerCase().indexOf(schemaContains) > -1) {
                tests.push(test);
            }
            if (config.nameContains && test.name && test.name.toLowerCase().indexOf(config.nameContains) > -1) {
                tests.push(test);
            }
            if (commentContains && test.comment && test.comment.toLowerCase().indexOf(commentContains) > -1) {
                tests.push(test);
            }
        }
    }

    if (!tests.length) {
        warning("Nothing to test.");
    }

    if (opt.list) {
        tests.forEach((test, index) => {
            console.log(`${++index}. ${test.schema == "public" ? "" : test.schema + "."}${test.name}${test.comment ? " (" + test.comment.replace(/[\r\n\t]/g, " ").trim() + ")"  : ""}`)
        });
        return;
    }

    var failedCount = 0;
    var passedCount = 0;
    var label = "Total " + tests.length.toString() + " tests";
    console.time(label);
    await Promise.all(tests.map(async (test) => {
        var cmd;
        if (test.type == "FUNCTION") {
            cmd = "select " + test.schema + "." + test.name + "();";
        } else if (test.type == "PROCEDURE") {
            cmd = "call " + test.schema + "." + test.name + "();";
        } else {
            return;
        }
        
        var testInfo = `${test.schema == "public" ? "" : test.schema + "."}${test.name}${test.comment ? " (" + test.comment.replace(/[\r\n\t]/g, " ").trim() + ")"  : ""}`;
        var result = await command(cmd, opt, ["--tuples-only", "--no-align"], config, true, true); 
        
        if (result.code != 0 || result.stderr || result.stdout == "f" || result.stdout.toLowerCase().startsWith("not ok")) {
            failed(testInfo);
            error(result.stderr || result.stdout);
            failedCount++;
        } else {
            passed(testInfo);
            passedCount++;
        }
    }));

    console.log();
    passed(passedCount.toString());
    if (failedCount > 0) {
        failed(failedCount.toString());
    }
    console.timeEnd(label);

    if (failedCount > 0) {
        // exit process with non-zero status
        process.exit(1);
    }
}


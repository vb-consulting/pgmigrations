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
        left join pg_catalog.pg_proc proc on r.specific_name = proc.proname || '_' || proc.oid
        left join pg_catalog.pg_description des on proc.oid = des.objoid
    where
        routine_schema not like 'pg_%'
        and routine_schema <> 'information_schema'
        and not lower(r.external_language) = any(array['c', 'internal'])
        and coalesce(r.type_udt_name, '') <> 'trigger'
        and (
            ({testFunctionsSchemaSimilarTo} is null or routine_schema like {testFunctionsSchemaSimilarTo})
            and ({testFunctionsNameSimilarTo} is null or routine_name like {testFunctionsNameSimilarTo})
            and ({testFunctionsCommentSimilarTo} is null or des.description like {testFunctionsCommentSimilarTo})
        )
    group by
        quote_ident(routine_schema), 
        quote_ident(routine_name), 
        routine_type,
        des.description
    having count(p.*) = 0
) sub;`;

function formatStrByName(str, obj) {
    return str.replace(/{([^{}]+)}/g, function(match, key) {
        let val = obj[key];
        if (val === undefined) {
            return match;
        }
        if (val == null) {
            return "NULL";
        }
        return "'" + val + "'";
    });
};

module.exports = async function(opt, config) {
    let tests = JSON.parse(await query(formatStrByName(testListQuery, {
        testFunctionsSchemaSimilarTo: config.testFunctionsSchemaSimilarTo,
        testFunctionsNameSimilarTo: config.testFunctionsNameSimilarTo,
        testFunctionsCommentSimilarTo: config.testFunctionsCommentSimilarTo
    }), opt, config));

    if (!tests.length) {
        warning("Nothing to test.");
    }

    if (opt.list) {
        tests.forEach((test, index) => {
            console.log(`${++index}. ${test.schema == "public" ? "" : test.schema + "."}${test.name}${test.comment ? " (" + test.comment.replace(/[\r\n\t]/g, " ").trim() + ")"  : ""}`)
        });
        return;
    }

    let failedCount = 0;
    let passedCount = 0;
    let label = "Total " + tests.length.toString() + " tests";
    console.time(label);
    await Promise.all(tests.map(async (test) => {
        let cmd;
        if (test.type == "FUNCTION") {
            if (config.testAutomaticallyRollbackFunctionTests) {
                cmd = "begin; select " + test.schema + "." + test.name + "(); rollback;";
            } else {
                cmd = "select " + test.schema + "." + test.name + "();";
            }
            
        } else if (test.type == "PROCEDURE") {
            cmd = "call " + test.schema + "." + test.name + "();";
        } else {
            return;
        }
        
        let testInfo = `${test.schema == "public" ? "" : test.schema + "."}${test.name}${test.comment ? " (" + test.comment.replace(/[\r\n\t]/g, " ").trim() + ")"  : ""}`;
        let result = await command(cmd, opt, ["--tuples-only", "--no-align"], config, true, true); 
        
        let lower = result.stderr ? result.stderr.toLowerCase() : "";
        if (result.code != 0 || result.stdout == "f" || result.stdout.toLowerCase().startsWith("not ok")) {
            failed(testInfo);
            error(result.stderr || result.stdout);
            failedCount++;
        } else if (lower.indexOf("error:") > -1 || lower.indexOf("fatal:") > -1 || lower.indexOf("panic:") > -1) {
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
        process.exit(config.failureExitCode);
    }
}


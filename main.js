const Random = require('random-js');
const stackTrace = require('stacktrace-parser');
const path = require("path")
var fs = require('fs'),
    xml2js = require('xml2js'),
    child  = require('child_process'); 
var parser = new xml2js.Parser();
var Bluebird = require('bluebird')

 


var finalResult ={};

function readResults(result)
{
    for( var i = 0; i < result.testsuite['$'].tests; i++ )
    {
        var testcase = result.testsuite.testcase[i];
        var testname = testcase['$'].classname+'.'+testcase['$'].name
        var status = testcase.hasOwnProperty('failure') || testcase.hasOwnProperty('error') ? "failed": "passed"
        if (!finalResult.hasOwnProperty(testname)) {
            finalResult[testname] = 0;
        }
        if (status === 'passed') {
            finalResult[testname]++;
        }
    }
}


const getAllFiles = function(dirPath, arrayOfFiles) {
files = fs.readdirSync(dirPath)

arrayOfFiles = arrayOfFiles || []
files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
    arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles)
    } else {
        if (file.endsWith('xml') && dirPath.includes("surefire-reports")) {
            arrayOfFiles.push(path.join(dirPath, "/", file))
        }
        else{
            arrayOfFiles.push(path.join(dirPath, "/", file))
        }
    }
})
return arrayOfFiles
}


async function calculatePriority()
{
    let allFiles = getAllFiles(process.env.HOME+'/iTrust2-v6/iTrust2/target/surefire-reports')
    for (var i = 0; i < 1; i++) {
        var contents = fs.readFileSync(allFiles[i])
        let xml2json = await Bluebird.fromCallback(cb => parser.parseString(contents, cb));
        await readResults(xml2json);
    }
}

// function traverse_with_dir(dir_path, result) {
//   files = fs.readdirSync(dir_path)
//   result = result
//   files.forEach(function(file) {
//     if (fs.statSync(dir_path + "/" + file).isDirectory()) {
//         result = traverse_with_dir(dir_path + "/" + file, result)
//     } 
//     else{
//             result.push(path.join(dir_path, "/", file))
//         }
//   })
//   return result
// }

class fuzzer {
    static random() {
        return fuzzer._random || fuzzer.seed(0)
    }
    
    static seed (kernel) {
        fuzzer._random = new Random.Random(Random.MersenneTwister19937.seed(kernel));
        return fuzzer._random;
    }

    static mutateString (val) {
        // MUTATE IMPLEMENTATION HERE
        var array = val.split('\n');

        //pick 10 percent of lines
        ten_percent_len = Math.floor(array.length/10)+1

        let i = 0
        var rand_index_list = []
        // console.log(array.slice(0,10))
        var rand_index
        while(i < ten_percent_len) {
            rand_index = Math.floor(Math.random() * array.length)
            if(rand_index_list.includes(rand_index)){
                continue
            }
            op = array[rand_index]

            //swap == with !=
            op = op.replace(/==/g,"!=")
            
            //swap 0 with 1
            op = op.replace(/0/g,"1")

            //swap < with >
            op = op.replace(/</g,">")

            //swap && with ||
            op = op.replace(/&&/g,"||")

            //swap + with -
            op = op.replace("+","-")

            //match strings and replace with ""
            op = op.replace(/"\w+"/i,"replaced")


            array[rand_index] = op
            i++
        }

        return array.join('\n');
    }
};


function randomize(f_list){

    let random_set = new Set()
    ten_percent_len = Math.floor(f_list.length/10)+1
    let i = 0
    while(i < ten_percent_len) {
        op = f_list[Math.floor(Math.random() * f_list.length)]
        if (!random_set.has(op)){
            random_set.add(op)
            i++
        }
    }
    let random_file_list =  Array.from(random_set)
    return random_file_list

}


function mutationTesting(random_file_list)
{    

    console.log(random_file_list)
    for (let file_name of random_file_list){
        let stringify = fs.readFileSync(file_name,'utf-8');
        let mutuatedString = fuzzer.mutateString(stringify);
        fs.writeFileSync(file_name,mutuatedString)
    }

}

function main(iterations){

    try {
        child.execSync("cd Trust2-v6/iTrust2 && mvn -f pom-data.xml process-test-classes")
    }
    catch(err){
        console.log(err)
    }

    f_list = getAllFiles(process.env.HOME+"/Trust2-v6/iTrust2/src/test/java/edu/ncsu/csc/itrust2",[]);

    while (iterations>0){

        var random_file_list = randomize(f_list)
    
        mutationTesting(random_file_list);

        try {
            child.execSync("cd Trust2-v6/iTrust2 && mvn clean test verify")
            await calculatePriority()
            iterations--;
        }
        catch(err){
            if (fs.existsSync('/iTrust2-v6/iTrust2/target/surefire-reports')){
                await calculatePriority()
                iterations--;
            }
        }
        child.execSync("git checkout")
    }
}

(async () => {
    await main();
})();

import {readFile,writeFile} from 'node:fs/promises';
import {createDatabase,migrate} from '../src/database.mjs';
import {importAdminReference} from '../src/admin-import.mjs';
const file=process.argv[2],reportPath=process.argv[3];
if(!file)throw Error('Provide the verified private administrator reference JSON file');
const source=JSON.parse(await readFile(file,'utf8')),db=createDatabase();
try{await migrate(db);const report=await importAdminReference(db,source,process.env.IMPORTED_ADMIN_PASSWORD,process.env.ADMIN_USERNAME||'admin');if(reportPath)await writeFile(reportPath,JSON.stringify(report,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify(report));}finally{await db.close();}

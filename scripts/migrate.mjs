import {createDatabase,migrate} from '../src/database.mjs';
const db=createDatabase();try{await migrate(db);console.log('PostgreSQL migrations are current.');}finally{await db.close();}

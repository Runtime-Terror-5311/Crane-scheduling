import fs from "fs";
import path from "path";
import { MongoClient, Db } from "mongodb";
import bcrypt from "bcryptjs";
import { User, Crane, CraneRequest, Schedule, ShiftReport, AuditLog, SystemSettings } from "../../types.js";

const DB_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DB_DIR, "db.json");

export interface DatabaseState {
  users: Array<User & { passwordHash: string }>;
  cranes: Crane[];
  requests: CraneRequest[];
  schedules: Schedule[];
  shiftReports: ShiftReport[];
  auditLogs: AuditLog[];
  settings: SystemSettings;
}

const getFallbackState = (): DatabaseState => {
  const salt = bcrypt.genSaltSync(4);
  const adminHash = bcrypt.hashSync("AdminPassword123", salt);
  const userHash = bcrypt.hashSync("Password123", salt);

  return {
    users: [
      {
        employeeId: "EMP001",
        name: "System Master",
        role: "Admin",
        area: null,
        phone: "+91-9988776655",
        email: "admin@craneops.com",
        passwordHash: adminHash,
      },
      {
        employeeId: "EMP101",
        name: "A. K. Sharma",
        role: "Area User",
        area: 1,
        craneNo: "A1",
        phone: "+91-9876543210",
        email: "sharma@craneops.com",
        passwordHash: userHash,
        planningPoints: 100,
      },
      {
        employeeId: "EMP102",
        name: "S. N. Rao",
        role: "Area User",
        area: 2,
        craneNo: "B1",
        phone: "+91-9876543211",
        email: "rao@craneops.com",
        passwordHash: userHash,
        planningPoints: 100,
      },
      {
        employeeId: "EMP103",
        name: "V. K. Singh",
        role: "Area User",
        area: 3,
        craneNo: "C1",
        phone: "+91-9876543212",
        email: "singh@craneops.com",
        passwordHash: userHash,
        planningPoints: 100,
      },
      {
        employeeId: "EMP104",
        name: "D. K. Patel",
        role: "Area User",
        area: 4,
        craneNo: "D1",
        phone: "+91-9876543213",
        email: "patel@craneops.com",
        passwordHash: userHash,
        planningPoints: 100,
      },
      {
        employeeId: "EMP105",
        name: "M. S. Reddy",
        role: "Area User",
        area: 5,
        craneNo: "E1",
        phone: "+91-9876543214",
        email: "reddy@craneops.com",
        passwordHash: userHash,
        planningPoints: 100,
      },
      {
        employeeId: "EMP106",
        name: "P. V. Joshi",
        role: "Area User",
        area: 6,
        craneNo: "F1New",
        phone: "+91-9876543215",
        email: "joshi@craneops.com",
        passwordHash: userHash,
        planningPoints: 100,
      },
      {
        employeeId: "EMP107",
        name: "H. S. Mehta",
        role: "Area User",
        area: 7,
        craneNo: "G1",
        phone: "+91-9876543216",
        email: "mehta@craneops.com",
        passwordHash: userHash,
        planningPoints: 100,
      },
      {
        employeeId: "EMP108",
        name: "R. K. Verma",
        role: "Area User",
        area: 8,
        craneNo: "A2",
        phone: "+91-9876543217",
        email: "verma@craneops.com",
        passwordHash: userHash,
        planningPoints: 100,
      },
      {
        employeeId: "EMP109",
        name: "N. K. Das",
        role: "Area User",
        area: 9,
        craneNo: "B2",
        phone: "+91-9876543218",
        email: "das@craneops.com",
        passwordHash: userHash,
        planningPoints: 100,
      },
      {
        employeeId: "EMP110",
        name: "B. C. Roy",
        role: "Area User",
        area: 10,
        craneNo: "C2",
        phone: "+91-9876543219",
        email: "roy@craneops.com",
        passwordHash: userHash,
        planningPoints: 100,
      },
      {
        employeeId: "EMP111",
        name: "G. S. Nair",
        role: "Area User",
        area: 12,
        craneNo: "D2",
        phone: "+91-9876543220",
        email: "nair@craneops.com",
        passwordHash: userHash,
        planningPoints: 100,
      },
      {
        employeeId: "EMP112",
        name: "K. R. Pillai",
        role: "Area User",
        area: 13,
        craneNo: "E2",
        phone: "+91-9876543221",
        email: "pillai@craneops.com",
        passwordHash: userHash,
        planningPoints: 100,
      },
      {
        employeeId: "EMP113",
        name: "T. R. Sen",
        role: "Area User",
        area: 14,
        craneNo: "F2",
        phone: "+91-9876543222",
        email: "sen@craneops.com",
        passwordHash: userHash,
        planningPoints: 100,
      },
      {
        employeeId: "EMP114",
        name: "S. K. Bose",
        role: "Area User",
        area: 15,
        craneNo: "G2",
        phone: "+91-9876543223",
        email: "bose@craneops.com",
        passwordHash: userHash,
        planningPoints: 100,
      },
      {
        employeeId: "EMP115",
        name: "J. N. Vyas",
        role: "Area User",
        area: 16,
        craneNo: "A3",
        phone: "+91-9876543224",
        email: "vyas@craneops.com",
        passwordHash: userHash,
        planningPoints: 100,
      },
      {
        employeeId: "EMP116",
        name: "A. P. Hegde",
        role: "Area User",
        area: 17,
        craneNo: "B4",
        phone: "+91-9876543225",
        email: "hegde@craneops.com",
        passwordHash: userHash,
        planningPoints: 100,
      },
      {
        employeeId: "EMP117",
        name: "L. K. Bhat",
        role: "Area User",
        area: 18,
        craneNo: "C3",
        phone: "+91-9876543226",
        email: "bhat@craneops.com",
        passwordHash: userHash,
        planningPoints: 100,
      },
      {
        employeeId: "EMP118",
        name: "V. S. Mani",
        role: "Area User",
        area: 19,
        craneNo: "D4",
        phone: "+91-9876543227",
        email: "mani@craneops.com",
        passwordHash: userHash,
        planningPoints: 100,
      },
      {
        employeeId: "EMP119",
        name: "S. R. Chawla",
        role: "Area User",
        area: 20,
        craneNo: "E3",
        phone: "+91-9876543228",
        email: "chawla@craneops.com",
        passwordHash: userHash,
        planningPoints: 100,
      },
      {
        employeeId: "EMP120",
        name: "M. K. Menon",
        role: "Area User",
        area: 21,
        craneNo: "F3",
        phone: "+91-9876543229",
        email: "menon@craneops.com",
        passwordHash: userHash,
        planningPoints: 100,
      },
      {
        employeeId: "EMP121",
        name: "A. R. Deshmukh",
        role: "Area User",
        area: 22,
        craneNo: "G3",
        phone: "+91-9876543230",
        email: "deshmukh@craneops.com",
        passwordHash: userHash,
        planningPoints: 100,
      }
    ],
    cranes: [
      // Bay 1 (Areas: 1 [Cols 1-10], 8 [Cols 11-20], 16 [Cols 21-30])
      { id: "A1", name: "Gantry A1", capacity: 10, minColumn: 1, maxColumn: 30, allocatedMinColumn: 1, allocatedMaxColumn: 10, currentColumn: 5, status: "Available", maintenanceNotes: "" },
      { id: "A2", name: "Gantry A2", capacity: 20, auxCapacity: 5, minColumn: 1, maxColumn: 30, allocatedMinColumn: 11, allocatedMaxColumn: 20, currentColumn: 15, status: "Available", maintenanceNotes: "" },
      { id: "A3", name: "Gantry A3", capacity: 10, minColumn: 1, maxColumn: 30, allocatedMinColumn: 21, allocatedMaxColumn: 30, currentColumn: 25, status: "Available", maintenanceNotes: "" },
      // Bay 2 (Areas: 2 [Cols 1-10], 9 [Cols 11-20], 17 [Cols 21-30])
      { id: "B1", name: "Gantry B1", capacity: 40, auxCapacity: 10, minColumn: 1, maxColumn: 30, allocatedMinColumn: 1, allocatedMaxColumn: 10, currentColumn: 5, status: "Available", maintenanceNotes: "" },
      { id: "B2", name: "Gantry B2", capacity: 20, auxCapacity: 5, minColumn: 1, maxColumn: 30, allocatedMinColumn: 11, allocatedMaxColumn: 20, currentColumn: 15, status: "Available", maintenanceNotes: "" },
      { id: "B3", name: "Gantry B3", capacity: 10, minColumn: 1, maxColumn: 30, allocatedMinColumn: 21, allocatedMaxColumn: 30, currentColumn: 23, status: "Available", maintenanceNotes: "" },
      { id: "B4", name: "Gantry B4", capacity: 100, auxCapacity: 20, minColumn: 1, maxColumn: 30, allocatedMinColumn: 21, allocatedMaxColumn: 30, currentColumn: 27, status: "Available", maintenanceNotes: "" },
      // Bay 3 (Areas: 3 [Cols 1-10], 10 [Cols 11-20], 18 [Cols 21-30])
      { id: "C1", name: "Gantry C1", capacity: 63, auxCapacity: 10, minColumn: 1, maxColumn: 30, allocatedMinColumn: 1, allocatedMaxColumn: 10, currentColumn: 5, status: "Available", maintenanceNotes: "" },
      { id: "C2", name: "Gantry C2", capacity: 10, minColumn: 1, maxColumn: 30, allocatedMinColumn: 11, allocatedMaxColumn: 20, currentColumn: 15, status: "Available", maintenanceNotes: "" },
      { id: "C3", name: "Gantry C3", capacity: 40, auxCapacity: 10, minColumn: 1, maxColumn: 30, allocatedMinColumn: 21, allocatedMaxColumn: 30, currentColumn: 25, status: "Available", maintenanceNotes: "" },
      // Bay 4 (Areas: 4 [Cols 1-10], 12 [Cols 11-20], 19 [Cols 21-30])
      { id: "D1", name: "Gantry D1", capacity: 10, minColumn: 1, maxColumn: 30, allocatedMinColumn: 1, allocatedMaxColumn: 10, currentColumn: 5, status: "Available", maintenanceNotes: "" },
      { id: "D2", name: "Gantry D2", capacity: 30, auxCapacity: 10, minColumn: 1, maxColumn: 30, allocatedMinColumn: 11, allocatedMaxColumn: 20, currentColumn: 15, status: "Available", maintenanceNotes: "" },
      { id: "D3", name: "Gantry D3", capacity: 10, minColumn: 1, maxColumn: 30, allocatedMinColumn: 21, allocatedMaxColumn: 30, currentColumn: 23, status: "Available", maintenanceNotes: "" },
      { id: "D4", name: "Gantry D4", capacity: 63, auxCapacity: 10, minColumn: 1, maxColumn: 30, allocatedMinColumn: 21, allocatedMaxColumn: 30, currentColumn: 27, status: "Available", maintenanceNotes: "" },
      // Bay 5 (Areas: 5 [Cols 1-10], 13 [Cols 11-20], 20 [Cols 21-30])
      { id: "E1", name: "Gantry E1", capacity: 15, minColumn: 1, maxColumn: 30, allocatedMinColumn: 1, allocatedMaxColumn: 10, currentColumn: 5, status: "Available", maintenanceNotes: "" },
      { id: "E2", name: "Gantry E2", capacity: 20, auxCapacity: 10, minColumn: 1, maxColumn: 30, allocatedMinColumn: 11, allocatedMaxColumn: 20, currentColumn: 15, status: "Available", maintenanceNotes: "" },
      { id: "E3", name: "Gantry E3", capacity: 20, auxCapacity: 5, minColumn: 1, maxColumn: 30, allocatedMinColumn: 21, allocatedMaxColumn: 30, currentColumn: 25, status: "Available", maintenanceNotes: "" },
      // Bay 6 (Areas: 6 [Cols 1-10], 14 [Cols 11-20], 21 [Cols 21-30])
      { id: "F1New", name: "Gantry F1New", capacity: 40, auxCapacity: 10, minColumn: 1, maxColumn: 30, allocatedMinColumn: 1, allocatedMaxColumn: 10, currentColumn: 4, status: "Available", maintenanceNotes: "" },
      { id: "F1Old", name: "Gantry F1Old", capacity: 10, minColumn: 1, maxColumn: 30, allocatedMinColumn: 1, allocatedMaxColumn: 10, currentColumn: 7, status: "Available", maintenanceNotes: "" },
      { id: "F2", name: "Gantry F2", capacity: 40, auxCapacity: 10, minColumn: 1, maxColumn: 30, allocatedMinColumn: 11, allocatedMaxColumn: 20, currentColumn: 15, status: "Available", maintenanceNotes: "" },
      { id: "F3", name: "Gantry F3", capacity: 40, auxCapacity: 10, minColumn: 1, maxColumn: 30, allocatedMinColumn: 21, allocatedMaxColumn: 30, currentColumn: 25, status: "Available", maintenanceNotes: "" },
      // Bay 7 (Areas: 7 [Cols 1-10], 15 [Cols 11-20], 22 [Cols 21-30])
      { id: "G1", name: "Gantry G1", capacity: 20, auxCapacity: 5, minColumn: 1, maxColumn: 30, allocatedMinColumn: 1, allocatedMaxColumn: 10, currentColumn: 5, status: "Available", maintenanceNotes: "" },
      { id: "G2", name: "Gantry G2", capacity: 40, auxCapacity: 10, minColumn: 1, maxColumn: 30, allocatedMinColumn: 11, allocatedMaxColumn: 20, currentColumn: 15, status: "Available", maintenanceNotes: "" },
      { id: "G3", name: "Gantry G3", capacity: 40, auxCapacity: 10, minColumn: 1, maxColumn: 30, allocatedMinColumn: 21, allocatedMaxColumn: 30, currentColumn: 25, status: "Available", maintenanceNotes: "" },
    ],
    requests: [],
    schedules: [],
    shiftReports: [],
    auditLogs: [],
    settings: {
      bufferTimeMinutes: 5,
      maxCranes: 4,
      maintenanceWindowOpen: false,
      systemLocked: false,
    },
  };
};

export let cachedState: DatabaseState | null = null;
export let isMongoConnected = false;
export let mongoDb: Db | null = null;
export let isDirty = false;

class AsyncLock {
  private promise: Promise<void> = Promise.resolve();

  async acquire(): Promise<() => void> {
    let release: () => void = () => {};
    const nextPromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    const currentPromise = this.promise;
    this.promise = currentPromise.then(() => nextPromise);
    await currentPromise;
    return release;
  }
}

const dbLock = new AsyncLock();

const initLocalDB = async (): Promise<void> => {
  console.log("Using local JSON file database fallback...");
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      cachedState = JSON.parse(data);
      console.log("Loaded system state from local JSON file.");
    } else {
      const initialState = getFallbackState();
      fs.writeFileSync(DB_FILE, JSON.stringify(initialState, null, 2), "utf-8");
      cachedState = initialState;
      console.log("Initialized new empty local JSON file state.");
    }
  } catch (err) {
    console.error("Failed to initialize local JSON database:", err);
    cachedState = getFallbackState();
  }
};

export const initDB = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.log("MONGODB_URI not provided. Falling back to local DB.");
    isMongoConnected = false;
    await initLocalDB();
    return;
  }

  try {
    console.log("Connecting to MongoDB (Direct Fetch Mode)...");
    const client = new MongoClient(mongoUri, {
      connectTimeoutMS: 10000,
    });
    await client.connect();
    console.log("Connected to MongoDB successfully!");

    let dbName = client.db().databaseName;
    console.log(`Default database from URI: ${dbName}`);

    try {
      const adminDb = client.db().admin();
      const dbsInfo = await adminDb.listDatabases();
      const dbNames = dbsInfo.databases.map((db) => db.name);
      console.log("Databases present in cluster:", dbNames);

      if (dbNames.includes("crane_scheduler") && dbName !== "crane_scheduler") {
        const currentDbCols = await client.db(dbName).listCollections().toArray();
        let isEmpty = false;

        if (currentDbCols.length === 0) {
          isEmpty = true;
        } else if (currentDbCols.length === 1 && currentDbCols[0].name === "users") {
          const userCount = await client.db(dbName).collection("users").countDocuments();
          if (userCount === 0) {
            isEmpty = true;
          }
        }

        if (isEmpty) {
          console.log("Default database is empty, but 'crane_scheduler' exists with data. Switching database context to 'crane_scheduler'.");
          dbName = "crane_scheduler";
        }
      }
    } catch (dbErr) {
      console.warn("Could not list databases or perform auto-discovery:", dbErr);
    }

    mongoDb = client.db(dbName);
    isMongoConnected = true;

    // Direct fetch immediately to populate the cache
    await refreshStateFromMongo();
  } catch (err) {
    console.error("CRITICAL: MongoDB connection failed:", err);
    isMongoConnected = false;
    await initLocalDB();
  }

  // Ensure all default users exist in cachedState
  let updated = false;
  const defaultState = getFallbackState();
  if (cachedState && cachedState.users) {
    for (const defaultUser of defaultState.users) {
      const exists = cachedState.users.some((u) => u.employeeId === defaultUser.employeeId);
      if (!exists) {
        cachedState.users.push(defaultUser);
        updated = true;
      }
    }
  }

  // Unconditional migration of cranes list and user craneNo assignments to upgrade the database on startup
  if (cachedState) {
    // Overwrite with the 24 newly specified cranes
    cachedState.cranes = defaultState.cranes;
    updated = true;

    // Migrate user assignments
    const craneNoMap: Record<string, string> = {
      "1-1": "A1",
      "1-2": "A2",
      "1-3": "A3",
      "2-1": "B1",
      "2-2": "B2",
      "2-3": "B4",
      "3-1": "C1",
      "3-2": "C2",
      "3-3": "C3",
      "4-1": "D1",
      "4-2": "D2",
      "4-3": "D4",
      "5-1": "E1",
      "5-2": "E2",
      "5-3": "E3",
      "6-1": "F1New",
      "6-2": "F2",
      "6-3": "F3",
      "7-1": "G1",
      "7-2": "G2",
      "7-3": "G3"
    };

    if (cachedState.users) {
      for (const u of cachedState.users) {
        if (u.craneNo && craneNoMap[u.craneNo]) {
          u.craneNo = craneNoMap[u.craneNo];
          updated = true;
        } else if (u.role === "Area User" && (!u.craneNo || u.craneNo === "Any")) {
          const matchingDefault = defaultState.users.find(du => du.employeeId === u.employeeId);
          if (matchingDefault && matchingDefault.craneNo) {
            u.craneNo = matchingDefault.craneNo;
            updated = true;
          }
        }
      }
    }
  }

  if (updated) {
    isDirty = true;
    if (isMongoConnected) {
      await persistStateToMongo();
    } else {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(cachedState, null, 2), "utf-8");
    }
    console.log("Successfully upgraded database with upgraded cranes list and user craneNo assignments.");
  }
};

export const refreshStateFromMongo = async (): Promise<void> => {
  if (!isMongoConnected || !mongoDb) {
    // Local fallback refresh
    if (fs.existsSync(DB_FILE)) {
      try {
        const data = fs.readFileSync(DB_FILE, "utf-8");
        cachedState = JSON.parse(data);
      } catch (e) {
        console.error("Failed to read local DB fallback:", e);
      }
    }
    isDirty = false;
    return;
  }

  try {
    const [users, cranes, requests, schedules, shiftReports, auditLogs, settingsDoc] = await Promise.all([
      mongoDb.collection("users").find().toArray(),
      mongoDb.collection("cranes").find().toArray(),
      mongoDb.collection("requests").find().toArray(),
      mongoDb.collection("schedules").find().toArray(),
      mongoDb.collection("shift_reports").find().toArray(),
      mongoDb.collection("audit_logs").find().toArray(),
      mongoDb.collection("settings").findOne({ _id: "global" as any })
    ]);

    if (users.length === 0) {
      console.log("MongoDB is connected but empty. Seeding initial dummy dataset...");
      cachedState = getFallbackState();
      await persistStateToMongo();
      return;
    }

    const cleanAndDeduplicate = (arr: any[], keyField: string) => {
      const seen = new Set();
      const result: any[] = [];
      for (const item of arr) {
        const { _id, ...rest } = item;
        const key = rest[keyField];
        if (key !== undefined && key !== null) {
          if (!seen.has(key)) {
            seen.add(key);
            result.push(rest);
          }
        } else {
          result.push(rest);
        }
      }
      return result;
    };

    cachedState = {
      users: cleanAndDeduplicate(users, "employeeId"),
      cranes: cleanAndDeduplicate(cranes, "id"),
      requests: cleanAndDeduplicate(requests, "id"),
      schedules: cleanAndDeduplicate(schedules, "id"),
      shiftReports: cleanAndDeduplicate(shiftReports, "id"),
      auditLogs: cleanAndDeduplicate(auditLogs, "id"),
      settings: settingsDoc ? {
        bufferTimeMinutes: settingsDoc.bufferTimeMinutes ?? 5,
        maxCranes: settingsDoc.maxCranes ?? 3,
        maintenanceWindowOpen: settingsDoc.maintenanceWindowOpen ?? false,
        systemLocked: settingsDoc.systemLocked ?? false,
      } : {
        bufferTimeMinutes: 5,
        maxCranes: 3,
        maintenanceWindowOpen: false,
        systemLocked: false,
      },
    };

    isDirty = false;
    console.log(`Directly fetched MongoDB data in parallel: ${users.length} users, ${cranes.length} cranes, ${requests.length} requests.`);
  } catch (err: any) {
    console.error("Failed to fetch state from MongoDB collections:", err);
    throw new Error("Failed to load state from Database: " + err.message);
  }
};

export const persistStateToMongo = async (): Promise<void> => {
  if (!cachedState) return;

  if (!isMongoConnected || !mongoDb) {
    // Local save
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(cachedState, null, 2), "utf-8");
      isDirty = false;
    } catch (err) {
      console.error("Failed to persist state locally:", err);
    }
    return;
  }

  try {
    const cleanForInsert = (arr: any[]) => arr.map(({ _id, ...rest }) => rest);

    const persistCollection = async (colName: string, data: any[]) => {
      await mongoDb.collection(colName).deleteMany({});
      if (data.length > 0) {
        await mongoDb.collection(colName).insertMany(cleanForInsert(data));
      }
    };

    await Promise.all([
      persistCollection("users", cachedState.users),
      persistCollection("cranes", cachedState.cranes),
      persistCollection("requests", cachedState.requests),
      persistCollection("schedules", cachedState.schedules),
      persistCollection("shift_reports", cachedState.shiftReports),
      persistCollection("audit_logs", cachedState.auditLogs),
      mongoDb.collection("settings").replaceOne(
        { _id: "global" as any },
        { _id: "global" as any, ...cachedState.settings },
        { upsert: true }
      )
    ]);

    isDirty = false;
    console.log("Successfully persisted updated system state in parallel to MongoDB collections.");
  } catch (err: any) {
    console.error("Failed to write state to MongoDB collections:", err);
    throw new Error("Failed to save state to Database: " + err.message);
  }
};

export const readDB = (): DatabaseState => {
  if (!cachedState) {
    throw new Error("Database state is not loaded yet.");
  }
  return cachedState;
};

export const writeDB = (state: DatabaseState): void => {
  cachedState = state;
  isDirty = true;
};

export const logActivity = (
  employeeId: string,
  name: string,
  action: string,
  details: string
): void => {
  const db = readDB();
  const log: AuditLog = {
    id: `LOG-${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`,
    timestamp: new Date().toISOString(),
    employeeId,
    userName: name,
    action,
    details,
  };
  db.auditLogs.unshift(log);
  // Keep last 1000 logs to prevent memory inflation
  if (db.auditLogs.length > 1000) {
    db.auditLogs = db.auditLogs.slice(0, 1000);
  }
  writeDB(db);
};

export const forceSeedDB = async (): Promise<DatabaseState> => {
  // Clear everything except keeping settings defaults, or reset state to fallback
  const fallbackState = getFallbackState();
  cachedState = fallbackState;
  isDirty = false;

  if (!isMongoConnected || !mongoDb) {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(fallbackState, null, 2), "utf-8");
    console.log("Successfully reset local fallback database.");
    return fallbackState;
  }

  await mongoDb.collection("users").deleteMany({});
  await mongoDb.collection("cranes").deleteMany({});
  await mongoDb.collection("requests").deleteMany({});
  await mongoDb.collection("schedules").deleteMany({});
  await mongoDb.collection("shift_reports").deleteMany({});
  await mongoDb.collection("audit_logs").deleteMany({});
  await mongoDb.collection("settings").replaceOne(
    { _id: "global" as any },
    { _id: "global" as any, ...fallbackState.settings },
    { upsert: true }
  );

  console.log("Cleared MongoDB collections.");
  return fallbackState;
};

export const databaseLockMiddleware = async (req: any, res: any, next: any): Promise<void> => {
  const release = await dbLock.acquire();
  let hasReleased = false;

  const safeRelease = () => {
    if (!hasReleased) {
      release();
      hasReleased = true;
    }
  };

  let finishedCalled = false;
  const handleFinished = async () => {
    if (finishedCalled) return;
    finishedCalled = true;
    try {
      if (isDirty) {
        isDirty = false;
        if (isMongoConnected) {
          await persistStateToMongo();
        } else {
          if (cachedState) {
            fs.writeFileSync(DB_FILE, JSON.stringify(cachedState, null, 2), "utf-8");
          }
        }
      }
    } catch (err) {
      console.error("Error persisting state on request completion:", err);
    } finally {
      safeRelease();
    }
  };

  res.on("finish", () => {
    handleFinished();
  });

  res.on("close", () => {
    handleFinished();
  });

  try {
    if (isMongoConnected) {
      await refreshStateFromMongo();
    } else {
      if (!cachedState) {
        await initLocalDB();
      }
    }

    isDirty = false;

    next();
  } catch (err: any) {
    safeRelease();
    res.status(500).json({ error: "Failed to process database lock transaction: " + err.message });
  }
};

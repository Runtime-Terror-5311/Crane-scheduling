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
  return {
    users: [],
    cranes: [],
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
export let lastRefreshTime = 0;

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

  console.log("Database initialized without hardcoded startup seed/migration.");
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
    lastRefreshTime = Date.now();
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
    lastRefreshTime = Date.now();
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
      const now = Date.now();
      if (!cachedState || now - lastRefreshTime > 5000) {
        await refreshStateFromMongo();
      }
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

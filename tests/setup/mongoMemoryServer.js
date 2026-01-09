import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongoServer;

export async function startInMemoryMongo() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.disconnect();
  await mongoose.connect(uri, { autoIndex: false });
  return uri;
}

export async function stopInMemoryMongo() {
  if (mongoServer) {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

export async function clearDatabase() {
  const collections = Object.keys(mongoose.connection.collections);
  for (const collectionName of collections) {
    const collection = mongoose.connection.collections[collectionName];
    try {
      await collection.deleteMany();
    } catch (err) {
      // ignore
    }
  }
}

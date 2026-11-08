import { MongoClient } from 'mongodb';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const uri = 'mongodb+srv://admin:FamiliaChat2026!@chat.pdvv3et.mongodb.net/family-chat?retryWrites=true&w=majority';

async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('family-chat');
  const col = db.collection('sovereign_store');
  const store = await col.findOne({ _id: 'main_store' });
  if (store && store.data) {
    const huttmanId = 'huttman-ochoa-guardian-id';
    store.data.users[huttmanId] = {
      id: huttmanId,
      username: 'huttman ochoa',
      email: 'huttman@ochoa.com',
      passwordHash: 'FamiliaChat2026!',
      role: 'guardian',
      age: 35,
      publicKey: '2pgffvTvMNJvWIApROaBcoCxqmFgvR44KOKtyYKerGU=',
      avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=huttman%20ochoa&backgroundColor=4f46e5,0284c7,7c3aed,059669',
      createdAt: new Date().toISOString()
    };
    // Also connect to Tany and Re
    if (!store.data.contacts.some((c) => (c.userId === huttmanId && c.contactId === '4574e70f-aa62-4be9-9e01-113561a9ab52') || (c.contactId === huttmanId && c.userId === '4574e70f-aa62-4be9-9e01-113561a9ab52'))) {
      store.data.contacts.push({
        id: 'contact-huttman-re',
        userId: '4574e70f-aa62-4be9-9e01-113561a9ab52',
        contactId: huttmanId,
        approvedByGuardianId: huttmanId,
        createdAt: new Date().toISOString()
      });
    }
    if (!store.data.contacts.some((c) => (c.userId === huttmanId && c.contactId === 'e0fd2534-67be-44a7-9eb9-072ca33f158b') || (c.contactId === huttmanId && c.userId === 'e0fd2534-67be-44a7-9eb9-072ca33f158b'))) {
      store.data.contacts.push({
        id: 'contact-huttman-tany',
        userId: huttmanId,
        contactId: 'e0fd2534-67be-44a7-9eb9-072ca33f158b',
        approvedByGuardianId: huttmanId,
        createdAt: new Date().toISOString()
      });
    }

    const updateDoc = {
      $set: {
        data: store.data,
        updatedAt: new Date()
      }
    };
    await col.updateOne({ _id: 'main_store' }, updateDoc);
    console.log('SUCCESS_CREATED_HUTTMAN_OCHOA');
  }
  await client.close();
}

run().catch(console.error);

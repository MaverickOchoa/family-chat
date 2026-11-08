import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://admin:FamiliaChat2026!@chat.pdvv3et.mongodb.net/family-chat?retryWrites=true&w=majority';

async function update() {
  const client = new MongoClient(uri, { tlsAllowInvalidCertificates: true });
  await client.connect();
  const db = client.db('family-chat');
  const col = db.collection('sovereign_store');
  const store = await col.findOne({ _id: 'main_store' });

  if (store && store.data) {
    const data = store.data;

    // 1. Update Tania mama
    const taniaId = 'e0fd2534-67be-44a7-9eb9-072ca33f158b';
    if (data.users[taniaId]) {
      data.users[taniaId].username = 'Tania mama';
      data.users[taniaId].passwordHash = 'cuentaO2026';
      data.users[taniaId].avatar = 'https://api.dicebear.com/7.x/initials/svg?seed=Tania%20mama&backgroundColor=ec4899,8b5cf6,f43f5e';
    }

    // 2. Update Re (Daughter)
    const reId = '4574e70f-aa62-4be9-9e01-113561a9ab52';
    if (data.users[reId]) {
      data.users[reId].guardianId = 'huttman-ochoa-guardian-id';
    }

    // 3. Ensure contacts between Tania mama and Re
    const taniaReContact = data.contacts.some(
      (c) => (c.userId === taniaId && c.contactId === reId) || (c.userId === reId && c.contactId === taniaId)
    );
    if (!taniaReContact) {
      data.contacts.push({
        id: 'contact-tania-re',
        userId: taniaId,
        contactId: reId,
        approvedByGuardianId: 'huttman-ochoa-guardian-id',
        createdAt: new Date().toISOString()
      });
    }

    await col.updateOne({ _id: 'main_store' }, { $set: { data, updatedAt: new Date() } });
    console.log('SUCCESS_UPDATED_ACCOUNTS');
  } else {
    console.error('Store not found');
  }

  await client.close();
}

update().catch(console.error);

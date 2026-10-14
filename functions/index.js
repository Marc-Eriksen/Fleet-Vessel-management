// OCEANHUB Cloud Functions. The browser SDK can't change another user's account,
// so anything an admin does to an owner's login beyond creating it happens here.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();

/* Admin changes an owner's login: { uid, email?, password? }. The caller must
   have role 'admin' and the target must be an owner account, so this can't be
   used on the admin's own or any other admin's login. */
exports.updateOwnerLogin = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const users = admin.database().ref('oceanhub/users');
  const callerRole = (await users.child(req.auth.uid + '/role').once('value')).val();
  if (callerRole !== 'admin') throw new HttpsError('permission-denied', 'Only the admin can change owner logins.');

  const { uid, email, password } = req.data || {};
  if (typeof uid !== 'string' || !uid) throw new HttpsError('invalid-argument', 'Missing owner account.');
  const changes = {};
  if (email !== undefined) {
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new HttpsError('invalid-argument', 'Enter a valid email address.');
    changes.email = email.trim().toLowerCase();
  }
  if (password !== undefined) {
    if (typeof password !== 'string' || password.length < 6) throw new HttpsError('invalid-argument', 'Passwords need at least 6 characters.');
    changes.password = password;
  }
  if (!Object.keys(changes).length) throw new HttpsError('invalid-argument', 'Nothing to change.');

  const target = (await users.child(uid).once('value')).val();
  if (!target || target.role !== 'owner') throw new HttpsError('not-found', 'That owner login no longer exists.');

  try {
    await admin.auth().updateUser(uid, changes);
  } catch (err) {
    if (err.code === 'auth/email-already-exists') throw new HttpsError('already-exists', `${changes.email} already has an OCEANHUB account. Use a different email, or delete that user in the Firebase console (Authentication > Users).`);
    if (err.code === 'auth/user-not-found') throw new HttpsError('not-found', 'That owner login no longer exists.');
    throw err;
  }
  if (changes.email) await users.child(uid + '/email').set(changes.email);
  return { ok: true };
});

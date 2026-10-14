// OCEANHUB Cloud Functions. The browser SDK can't change another user's account,
// so anything an admin does to an owner's login beyond creating it happens here.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();

/* Admin sets an owner's password: { uid, password }. The caller must have
   role 'admin' and the target must be an owner account, so this can't be used
   to change the admin's own or any other admin's password. */
exports.setOwnerPassword = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const users = admin.database().ref('oceanhub/users');
  const callerRole = (await users.child(req.auth.uid + '/role').once('value')).val();
  if (callerRole !== 'admin') throw new HttpsError('permission-denied', 'Only the admin can set owner passwords.');

  const { uid, password } = req.data || {};
  if (typeof uid !== 'string' || !uid) throw new HttpsError('invalid-argument', 'Missing owner account.');
  if (typeof password !== 'string' || password.length < 6) throw new HttpsError('invalid-argument', 'Passwords need at least 6 characters.');

  const target = (await users.child(uid).once('value')).val();
  if (!target || target.role !== 'owner') throw new HttpsError('not-found', 'That owner login no longer exists.');

  await admin.auth().updateUser(uid, { password });
  return { ok: true };
});

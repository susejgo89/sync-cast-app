const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

/**
 * Cloud Function para crear una sub-cuenta (cliente) para un reseller.
 * Es una función "onCall", lo que significa que se invoca desde el cliente
 * y automáticamente maneja la autenticación del usuario que la llama.
 */
exports.createClientUser = functions.https.onCall(async (data, context) => {
    // 1. VERIFICACIÓN DE SEGURIDAD: Asegurarse de que el usuario que llama está autenticado.
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "La función solo puede ser llamada por un usuario autenticado.",
        );
    }

    const resellerId = context.auth.uid;
    const { email, password, screenLimit, storageLimitBytes } = data;

    // Validación básica de los datos de entrada
    if (!email || !password || password.length < 6 || screenLimit < 0 || storageLimitBytes < 0) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Por favor, proporciona datos válidos.",
        );
    }

    // Usamos una transacción para garantizar la consistencia de los datos.
    // Si algo falla a mitad de camino, todos los cambios se revierten.
    return db.runTransaction(async (transaction) => {
        // 2. OBTENER DATOS DEL RESELLER: Verificamos su rol y sus límites.
        const resellerRef = db.collection("users").doc(resellerId);
        const resellerDoc = await transaction.get(resellerRef);

        if (!resellerDoc.exists || resellerDoc.data().role !== "reseller") {
            throw new functions.https.HttpsError(
                "permission-denied",
                "No tienes permisos para realizar esta acción.",
            );
        }

        const resellerData = resellerDoc.data();

        // 3. VALIDACIÓN DEL POOL: Calculamos los recursos ya asignados.
        const clientsQuery = db.collection("users").where("ownerId", "==", resellerId);
        const clientsSnapshot = await transaction.get(clientsQuery);

        let usedScreens = 0;
        let usedStorage = 0;
        clientsSnapshot.forEach(doc => {
            usedScreens += doc.data().screenLimit || 0;
            usedStorage += doc.data().storageLimit || 0;
        });

        // Comprobamos si hay suficientes recursos en el pool del reseller.
        if (usedScreens + screenLimit > resellerData.totalScreenLimit) {
            throw new functions.https.HttpsError(
                "resource-exhausted",
                "No tienes suficientes pantallas en tu pool para asignar esta cantidad.",
            );
        }
        if (usedStorage + storageLimitBytes > resellerData.totalStorageLimit) {
            throw new functions.https.HttpsError(
                "resource-exhausted",
                "No tienes suficiente almacenamiento en tu pool para asignar esta cantidad.",
            );
        }

        // 4. CREACIÓN DE LA SUB-CUENTA
        // 4.1. Crear el usuario en Firebase Authentication.
        const newUserRecord = await admin.auth().createUser({
            email: email,
            password: password,
            emailVerified: true, // Lo creamos como verificado ya que el reseller es responsable.
        });

        // 4.2. Crear el documento del usuario en Firestore.
        const newUserRef = db.collection("users").doc(newUserRecord.uid);
        transaction.set(newUserRef, {
            email: email,
            ownerId: resellerId, // VITAL: Enlazamos al reseller.
            role: "client",
            status: "active",
            screenLimit: screenLimit,
            storageLimit: storageLimitBytes,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true, message: "Cliente creado con éxito.", userId: newUserRecord.uid };
    });
});

/**
 * Cloud Function para eliminar una sub-cuenta (cliente) y todos sus datos asociados.
 */
exports.deleteClientUser = functions.https.onCall(async (data, context) => {
    // 1. VERIFICACIÓN DE SEGURIDAD
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "La función solo puede ser llamada por un usuario autenticado.");
    }

    const resellerId = context.auth.uid;
    const { subAccountId } = data;

    if (!subAccountId) {
        throw new functions.https.HttpsError("invalid-argument", "Se requiere el ID de la sub-cuenta.");
    }

    const resellerRef = db.collection("users").doc(resellerId);
    const subAccountRef = db.collection("users").doc(subAccountId);

    const [resellerDoc, subAccountDoc] = await Promise.all([resellerRef.get(), subAccountRef.get()]);

    // 2. VERIFICACIÓN DE PERMISOS
    if (!resellerDoc.exists || resellerDoc.data().role !== "reseller") {
        throw new functions.https.HttpsError("permission-denied", "No tienes permisos de reseller.");
    }

    if (!subAccountDoc.exists || subAccountDoc.data().ownerId !== resellerId) {
        throw new functions.https.HttpsError("permission-denied", "No eres el propietario de esta sub-cuenta.");
    }

    // 3. ELIMINACIÓN DE DATOS
    try {
        // 3.1. Eliminar usuario de Firebase Authentication
        await admin.auth().deleteUser(subAccountId);

        // 3.2. Eliminar documento del usuario en Firestore
        await db.collection("users").doc(subAccountId).delete();

        // 3.3. Eliminación en cascada de datos en otras colecciones
        const collectionsToDelete = ["media", "playlists", "musicPlaylists", "screens", "groups", "qrMenus"];
        const deletePromises = collectionsToDelete.map(async (collectionName) => {
            const querySnapshot = await db.collection(collectionName).where("userId", "==", subAccountId).get();
            const batch = db.batch();
            querySnapshot.forEach(doc => {
                // Si es un archivo de media, también borramos de Storage
                if (collectionName === 'media' && doc.data().storagePath) {
                    admin.storage().bucket().file(doc.data().storagePath).delete().catch(err => console.error(`Failed to delete storage file ${doc.data().storagePath}:`, err));
                }
                batch.delete(doc.ref);
            });
            return batch.commit();
        });

        await Promise.all(deletePromises);

        return { success: true, message: "Cliente y todos sus datos eliminados con éxito." };
    } catch (error) {
        console.error("Error al eliminar la sub-cuenta:", error);
        throw new functions.https.HttpsError("internal", "Ocurrió un error al eliminar la cuenta.", error.message);
    }
});

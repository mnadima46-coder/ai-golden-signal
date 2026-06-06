/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc, setDoc, deleteDoc, getDocFromServer, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './googleAuth';
import type { BackupData } from './googleDrive';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validates connection to Firestore on app startup.
 */
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

/**
 * Saves/updates user backup data to Firestore
 */
export async function saveBackupToFirestore(userId: string, data: Omit<BackupData, 'userId'> & { userId?: string }): Promise<boolean> {
  const path = `backups/${userId}`;
  try {
    const payload = {
      ...data,
      userId,
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, 'backups', userId), payload);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

/**
 * Fetches user backup data from Firestore if it exists
 */
export async function getBackupFromFirestore(userId: string): Promise<any | null> {
  const path = `backups/${userId}`;
  try {
    const docSnap = await getDoc(doc(db, 'backups', userId));
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

/**
 * Deletes user backup data from Firestore
 */
export async function deleteBackupFromFirestore(userId: string): Promise<boolean> {
  const path = `backups/${userId}`;
  try {
    await deleteDoc(doc(db, 'backups', userId));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
}

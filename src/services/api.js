// filepath: /Users/gre/Documents/___www/bl-tool-calendar-r/src/api.js
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function fetchTestimonyData(docRef) {
  try {
    const testimonyRef = doc(db, 'embeds', docRef); // Remplacez 'questions' par le nom de votre collection
    const docSnap = await getDoc(testimonyRef);

    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      console.error('No document found');
      return null;
    }
  } catch (error) {
    console.error('Error fetching testimony data:', error);
    throw error;
  }
}
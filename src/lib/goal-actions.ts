'use server';

import { z } from "zod";
import { db } from "./firebase";
import { addDoc, collection, doc, runTransaction, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Goal, Deposit, NormalGoal } from "./types";
import { depositToGoal } from "./blockchain";

const SaveGoalMetadataSchema = z.object({
  name: z.string().min(3),
  appId: z.number().gt(0),
});

export async function saveGoalMetadata(data: { name: string; appId: number }) {
  const validation = SaveGoalMetadataSchema.safeParse(data);

  if (!validation.success) {
    return { error: "Invalid data" };
  }

  const { name, appId } = validation.data;

  try {
    await addDoc(collection(db, "goals"), {
      name,
      appId,
      createdAt: serverTimestamp(),
      totalDeposited: 0,
      isCompleted: false,
    });

    revalidatePath("/goals");
    return { success: true };

  } catch (error) {
    console.error("Error saving goal metadata:", error);
    return { error: "Could not save goal metadata." };
  }
}

export async function saveDeposit(appId: number, amount: number, txId: string) {
  try {
    const goalRef = doc(db, "goals", appId.toString()); // Assuming appId is the document ID

    await runTransaction(db, async (transaction) => {
      const goalDoc = await transaction.get(goalRef);
      if (!goalDoc.exists()) {
        throw new Error("Goal does not exist!");
      }

      const newTotal = goalDoc.data().totalDeposited + amount;
      transaction.update(goalRef, { totalDeposited: newTotal });

      const depositRef = collection(goalRef, "deposits");
      transaction.set(doc(depositRef), {
        amount,
        txId,
        createdAt: serverTimestamp(),
      });
    });

    revalidatePath(`/goal/${appId}`);
    return { success: true };

  } catch (error) {
    console.error("Error saving deposit:", error);
    return { error: "Could not save deposit." };
  }
}

export async function checkGoalCompletion(appId: number) {
    // ... Implementation for checking goal completion
}

export async function createNormalGoal(goal: NormalGoal) {
    // ... Implementation for creating a normal goal
}

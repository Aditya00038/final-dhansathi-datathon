import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { NextResponse } from "next/server";
import type { Goal } from "@/lib/types";

// Helper to convert Firestore Timestamps to ISO strings
const serializeTimestamps = (data: any): any => {
    if (data === null || data === undefined) {
        return data;
    }
    if (typeof data.toDate === 'function') { // Check if it's a Firestore Timestamp
        return data.toDate().toISOString();
    }
    if (Array.isArray(data)) {
        return data.map(serializeTimestamps);
    }
    if (typeof data === 'object') {
        const res: { [key: string]: any } = {};
        for (const key in data) {
            res[key] = serializeTimestamps(data[key]);
        }
        return res;
    }
    return data;
};


export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
       return NextResponse.json({ error: "Goal ID is required" }, { status: 400 });
    }

    const goalRef = doc(db, 'goals', id);
    const goalSnap = await getDoc(goalRef);

    if (!goalSnap.exists()) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }
    
    const goalData = goalSnap.data();
    const serializedData = serializeTimestamps(goalData);

    const goal: Goal = {
      id: goalSnap.id,
      ...serializedData
    } as Goal;


    return NextResponse.json(goal);
  } catch (error) {
    console.error("Failed to fetch goal:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

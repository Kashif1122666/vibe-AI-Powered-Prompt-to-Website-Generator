"use client"

import { useTRPC } from "@/trpc/client";
import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query"

export const Client = ()=>{
    const trpc = useTRPC();
    const {data}  = useSuspenseQuery(trpc.hello.queryOptions({text:"vibe"}));
    return(
        <div>
            {JSON.stringify(data)}
        </div>
    )
}
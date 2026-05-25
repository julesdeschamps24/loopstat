import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AlbumWall } from "@/components/album-wall";
import { FindEditor } from "@/components/find/find-editor";
import { getPaddedWallCovers } from "@/db/queries/wall-covers";

export const dynamic = "force-dynamic";

export default async function FindPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const wallCovers = await getPaddedWallCovers(session.user.id, null, 40);

  return (
    <>
      <AlbumWall covers={wallCovers} />
      <main
        id="main"
        className="flex-1 flex flex-col px-6 py-10 max-w-5xl mx-auto w-full"
      >
        <header className="mb-8">
          <h1 className="text-2xl font-semibold">Trouver des amis</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tape un pseudo ou un nom pour retrouver tes potes sur loopstat.
          </p>
        </header>
        <FindEditor />
      </main>
    </>
  );
}

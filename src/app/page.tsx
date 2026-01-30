import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen flex-col items-center justify-center">
       <h1 className="text-4xl font-bold">sanell.online</h1>
       <p className="mt-2 text-gray-500 text-center max-w-md">
       my online home for works and random experiments
      </p>
      <div className="mt-6 flex gap-4 text-sm text-gray-500">
        <a href="/works" className="hover:text-black">works</a>
        <a href="/experiments" className="hover:text-black">experiments</a>
      </div>

      </main>
    </div>
  );
}

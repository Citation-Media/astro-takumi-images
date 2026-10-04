// A React template; it may be async and fetch its own data before it renders.
const ReactCard = async () => {
  const label = await Promise.resolve("React template");
  return (
    <div className="flex h-full w-full flex-col justify-between bg-slate-950 p-20 font-sans text-white">
      <p className="font-mono text-2xl tracking-widest text-sky-300 uppercase">
        {label}
      </p>
      <h1 className="text-[clamp(3rem,6vw,6rem)] leading-none font-semibold">
        Hello from Takumi
      </h1>
      <p className="text-2xl text-slate-400">astro-takumi-images</p>
    </div>
  );
};

export default ReactCard;

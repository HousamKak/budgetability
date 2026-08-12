/// <reference types="vite/client" />

// The dirham package exposes its stylesheet via an exports-map subpath that
// TypeScript can't type; Vite resolves it as a plain CSS import.
declare module "dirham/css";

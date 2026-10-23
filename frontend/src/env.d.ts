/// <reference types="astro/client" />

interface Env {
  [key: string]: any;
  DB: D1Database;
  ML_CLIENT_ID?: string;
  ML_CLIENT_SECRET?: string;
  GMAIL_USER?: string;
  GMAIL_APP_PASSWORD?: string;
  DIGEST_TOKEN?: string;
  JWT_SECRET?: string;
  PUBLIC_JWT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  MP_ACCESS_TOKEN?: string;
  NVIDIA_API_KEY?: string;
  NODE_ENV?: string;
  PROD?: string;
  PUBLIC_API_URL?: string;
}

declare namespace App {
  interface Locals {
    [key: string]: any;
    runtime: {
      env: Env;
      ctx?: { waitUntil?: (promise: Promise<unknown>) => void };
      caches?: { default?: Cache };
    };
    adminUser?: Record<string, any>;
  }
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<any[]>;
  exec(query: string): Promise<any>;
  withSession(...args: any[]): any;
}

interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = any>(): Promise<T | null>;
  run<T = any>(): Promise<T>;
  all<T = any>(): Promise<T[] & { results: T[]; success: boolean; meta: any }>;
}

declare module "cloudflare:sockets" {
  export function connect(address: any, options?: any): any;
}

declare module "cloudflare:workers" {
  export interface D1Database {
    prepare(query: string): {
      bind(...values: any[]): any;
      first<T = any>(): Promise<T | null>;
      run<T = any>(): Promise<T>;
      all<T = any>(): Promise<{ results: T[]; success: boolean; meta: any }>;
    };
    batch(statements: any[]): Promise<any[]>;
  }
}

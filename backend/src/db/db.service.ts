import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Database, { Database as SqliteDatabase } from 'better-sqlite3';
import * as path from 'path';

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private db: SqliteDatabase;
  private readonly logger = new Logger(DbService.name);

  onModuleInit() {
    const dbPath = path.resolve(process.cwd(), '../data/cuentitas.db');
    try {
      // Abre la BD en modo solo lectura
      this.db = new Database(dbPath, { readonly: true });
      this.logger.log(`Conectado exitosamente a SQLite Data: ${dbPath}`);
    } catch (error) {
      this.logger.error(`Error al conectar con SQLite Data en ${dbPath}`, error);
    }
  }

  onModuleDestroy() {
    if (this.db) {
      this.db.close();
      this.logger.log('Conexión SQLite cerrada');
    }
  }

  public rawQuery(sql: string, params: any[] = []): any[] {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params);
    } catch (error) {
      this.logger.error(`Error executing SQL: ${sql}`, error);
      throw error;
    }
  }
}

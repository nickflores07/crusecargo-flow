export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          area_comercial: Database["public"]["Enums"]["area_comercial"]
          canal: string | null
          categoria_cliente: Database["public"]["Enums"]["categoria_cliente"]
          ciudad: string | null
          correo: string | null
          created_at: string
          created_by: string | null
          direccion: string | null
          dni: string | null
          ejecutivo_id: string | null
          estado: Database["public"]["Enums"]["estado_cliente"]
          fecha_alta: string
          id: string
          nombre_completo: string | null
          notas: string | null
          razon_social: string | null
          rubro: string | null
          ruc: string | null
          telefono: string | null
          tipo: Database["public"]["Enums"]["tipo_cliente"]
          updated_at: string
        }
        Insert: {
          area_comercial?: Database["public"]["Enums"]["area_comercial"]
          canal?: string | null
          categoria_cliente?: Database["public"]["Enums"]["categoria_cliente"]
          ciudad?: string | null
          correo?: string | null
          created_at?: string
          created_by?: string | null
          direccion?: string | null
          dni?: string | null
          ejecutivo_id?: string | null
          estado?: Database["public"]["Enums"]["estado_cliente"]
          fecha_alta?: string
          id?: string
          nombre_completo?: string | null
          notas?: string | null
          razon_social?: string | null
          rubro?: string | null
          ruc?: string | null
          telefono?: string | null
          tipo: Database["public"]["Enums"]["tipo_cliente"]
          updated_at?: string
        }
        Update: {
          area_comercial?: Database["public"]["Enums"]["area_comercial"]
          canal?: string | null
          categoria_cliente?: Database["public"]["Enums"]["categoria_cliente"]
          ciudad?: string | null
          correo?: string | null
          created_at?: string
          created_by?: string | null
          direccion?: string | null
          dni?: string | null
          ejecutivo_id?: string | null
          estado?: Database["public"]["Enums"]["estado_cliente"]
          fecha_alta?: string
          id?: string
          nombre_completo?: string | null
          notas?: string | null
          razon_social?: string | null
          rubro?: string | null
          ruc?: string | null
          telefono?: string | null
          tipo?: Database["public"]["Enums"]["tipo_cliente"]
          updated_at?: string
        }
        Relationships: []
      }
      contactos: {
        Row: {
          cargo: string | null
          celular: string | null
          cliente_id: string
          correo: string | null
          created_at: string
          cumpleanos: string | null
          es_principal: boolean
          id: string
          nombre: string
          notas: string | null
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          celular?: string | null
          cliente_id: string
          correo?: string | null
          created_at?: string
          cumpleanos?: string | null
          es_principal?: boolean
          id?: string
          nombre: string
          notas?: string | null
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          celular?: string | null
          cliente_id?: string
          correo?: string | null
          created_at?: string
          cumpleanos?: string | null
          es_principal?: boolean
          id?: string
          nombre?: string
          notas?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contactos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      datos_comerciales_cliente: {
        Row: {
          cliente_id: string
          competidor_actual: string | null
          contrato: boolean
          created_at: string
          facturacion_mensual_estimada: number | null
          frecuencia_envio: string | null
          id: string
          observaciones: string | null
          pct_devoluciones: number | null
          pct_entregas_a_tiempo: number | null
          peso_promedio_kg: number | null
          tarifa_negociada: number | null
          tipo_paquete: string | null
          updated_at: string
          volumen_envios_mes: number | null
          zonas_frecuentes: string | null
        }
        Insert: {
          cliente_id: string
          competidor_actual?: string | null
          contrato?: boolean
          created_at?: string
          facturacion_mensual_estimada?: number | null
          frecuencia_envio?: string | null
          id?: string
          observaciones?: string | null
          pct_devoluciones?: number | null
          pct_entregas_a_tiempo?: number | null
          peso_promedio_kg?: number | null
          tarifa_negociada?: number | null
          tipo_paquete?: string | null
          updated_at?: string
          volumen_envios_mes?: number | null
          zonas_frecuentes?: string | null
        }
        Update: {
          cliente_id?: string
          competidor_actual?: string | null
          contrato?: boolean
          created_at?: string
          facturacion_mensual_estimada?: number | null
          frecuencia_envio?: string | null
          id?: string
          observaciones?: string | null
          pct_devoluciones?: number | null
          pct_entregas_a_tiempo?: number | null
          peso_promedio_kg?: number | null
          tarifa_negociada?: number | null
          tipo_paquete?: string | null
          updated_at?: string
          volumen_envios_mes?: number | null
          zonas_frecuentes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "datos_comerciales_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      direcciones_entrega: {
        Row: {
          ciudad: string | null
          cliente_id: string
          created_at: string
          direccion: string
          es_principal: boolean
          etiqueta: string | null
          id: string
          referencia: string | null
          updated_at: string
        }
        Insert: {
          ciudad?: string | null
          cliente_id: string
          created_at?: string
          direccion: string
          es_principal?: boolean
          etiqueta?: string | null
          id?: string
          referencia?: string | null
          updated_at?: string
        }
        Update: {
          ciudad?: string | null
          cliente_id?: string
          created_at?: string
          direccion?: string
          es_principal?: boolean
          etiqueta?: string | null
          id?: string
          referencia?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "direcciones_entrega_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      importaciones_clientes: {
        Row: {
          actualizados: number
          archivo_nombre: string | null
          creados: number
          created_at: string
          errores: number
          id: string
          log: Json | null
          total: number
          user_id: string
        }
        Insert: {
          actualizados?: number
          archivo_nombre?: string | null
          creados?: number
          created_at?: string
          errores?: number
          id?: string
          log?: Json | null
          total?: number
          user_id: string
        }
        Update: {
          actualizados?: number
          archivo_nombre?: string | null
          creados?: number
          created_at?: string
          errores?: number
          id?: string
          log?: Json | null
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activo: boolean
          avatar_url: string | null
          created_at: string
          id: string
          nombre: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          avatar_url?: string | null
          created_at?: string
          id: string
          nombre?: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          avatar_url?: string | null
          created_at?: string
          id?: string
          nombre?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "administrador" | "supervisor" | "ejecutivo"
      area_comercial: "b2b" | "b2c"
      categoria_cliente: "institucional" | "comun"
      estado_cliente: "prospecto" | "activo" | "inactivo" | "perdido"
      tipo_cliente: "empresa" | "persona"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["administrador", "supervisor", "ejecutivo"],
      area_comercial: ["b2b", "b2c"],
      categoria_cliente: ["institucional", "comun"],
      estado_cliente: ["prospecto", "activo", "inactivo", "perdido"],
      tipo_cliente: ["empresa", "persona"],
    },
  },
} as const

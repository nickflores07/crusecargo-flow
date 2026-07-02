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
      ai_messages: {
        Row: {
          contenido: Json
          created_at: string
          id: string
          rol: string
          thread_id: string
          user_id: string
        }
        Insert: {
          contenido: Json
          created_at?: string
          id?: string
          rol: string
          thread_id: string
          user_id: string
        }
        Update: {
          contenido?: Json
          created_at?: string
          id?: string
          rol?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ai_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_threads: {
        Row: {
          created_at: string
          id: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          titulo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
          sector_id: string | null
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
          sector_id?: string | null
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
          sector_id?: string | null
          telefono?: string | null
          tipo?: Database["public"]["Enums"]["tipo_cliente"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectores"
            referencedColumns: ["id"]
          },
        ]
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
      cotizacion_items: {
        Row: {
          cantidad: number
          cotizacion_id: string
          created_at: string
          descripcion: string
          id: string
          importe: number
          orden: number
          precio_unit: number
        }
        Insert: {
          cantidad?: number
          cotizacion_id: string
          created_at?: string
          descripcion: string
          id?: string
          importe?: number
          orden?: number
          precio_unit?: number
        }
        Update: {
          cantidad?: number
          cotizacion_id?: string
          created_at?: string
          descripcion?: string
          id?: string
          importe?: number
          orden?: number
          precio_unit?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_items_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizaciones: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          ejecutivo_id: string | null
          estado: Database["public"]["Enums"]["cotizacion_estado"]
          fecha_emision: string
          fecha_vencimiento: string | null
          id: string
          igv: number
          moneda: string
          notas: string | null
          numero: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          ejecutivo_id?: string | null
          estado?: Database["public"]["Enums"]["cotizacion_estado"]
          fecha_emision?: string
          fecha_vencimiento?: string | null
          id?: string
          igv?: number
          moneda?: string
          notas?: string | null
          numero: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          ejecutivo_id?: string | null
          estado?: Database["public"]["Enums"]["cotizacion_estado"]
          fecha_emision?: string
          fecha_vencimiento?: string | null
          id?: string
          igv?: number
          moneda?: string
          notas?: string | null
          numero?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotizaciones_cliente_id_fkey"
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
      envios: {
        Row: {
          bultos: number | null
          cliente_id: string
          created_at: string
          created_by: string | null
          destino: string | null
          ejecutivo_id: string | null
          estado: Database["public"]["Enums"]["envio_estado"]
          fecha: string
          guia: string | null
          id: string
          importe: number | null
          notas: string | null
          origen: string | null
          peso_kg: number | null
          servicio: string | null
          updated_at: string
        }
        Insert: {
          bultos?: number | null
          cliente_id: string
          created_at?: string
          created_by?: string | null
          destino?: string | null
          ejecutivo_id?: string | null
          estado?: Database["public"]["Enums"]["envio_estado"]
          fecha?: string
          guia?: string | null
          id?: string
          importe?: number | null
          notas?: string | null
          origen?: string | null
          peso_kg?: number | null
          servicio?: string | null
          updated_at?: string
        }
        Update: {
          bultos?: number | null
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          destino?: string | null
          ejecutivo_id?: string | null
          estado?: Database["public"]["Enums"]["envio_estado"]
          fecha?: string
          guia?: string | null
          id?: string
          importe?: number | null
          notas?: string | null
          origen?: string | null
          peso_kg?: number | null
          servicio?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "envios_cliente_id_fkey"
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
      oportunidades: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          ejecutivo_id: string | null
          estado: Database["public"]["Enums"]["estado_oportunidad"]
          fecha_cierre_estimada: string | null
          id: string
          monto_potencial: number | null
          motivo_perdida: string | null
          notas: string | null
          orden: number
          peso_estimado_kg: number | null
          probabilidad: number
          servicio: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          ejecutivo_id?: string | null
          estado?: Database["public"]["Enums"]["estado_oportunidad"]
          fecha_cierre_estimada?: string | null
          id?: string
          monto_potencial?: number | null
          motivo_perdida?: string | null
          notas?: string | null
          orden?: number
          peso_estimado_kg?: number | null
          probabilidad?: number
          servicio?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          ejecutivo_id?: string | null
          estado?: Database["public"]["Enums"]["estado_oportunidad"]
          fecha_cierre_estimada?: string | null
          id?: string
          monto_potencial?: number | null
          motivo_perdida?: string | null
          notas?: string | null
          orden?: number
          peso_estimado_kg?: number | null
          probabilidad?: number
          servicio?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oportunidades_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
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
      sectores: {
        Row: {
          created_at: string
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      seguimientos: {
        Row: {
          cliente_id: string
          compromiso: string | null
          created_at: string
          fecha: string
          id: string
          proxima_accion_fecha: string | null
          proxima_accion_nota: string | null
          resultado: string | null
          tipo: Database["public"]["Enums"]["tipo_interaccion"]
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          cliente_id: string
          compromiso?: string | null
          created_at?: string
          fecha?: string
          id?: string
          proxima_accion_fecha?: string | null
          proxima_accion_nota?: string | null
          resultado?: string | null
          tipo: Database["public"]["Enums"]["tipo_interaccion"]
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          cliente_id?: string
          compromiso?: string | null
          created_at?: string
          fecha?: string
          id?: string
          proxima_accion_fecha?: string | null
          proxima_accion_nota?: string | null
          resultado?: string | null
          tipo?: Database["public"]["Enums"]["tipo_interaccion"]
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seguimientos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
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
      cotizacion_estado:
        | "borrador"
        | "enviada"
        | "pendiente"
        | "aceptada"
        | "rechazada"
        | "vencida"
      envio_estado: "en_transito" | "entregado" | "devuelto" | "anulado"
      estado_cliente:
        | "prospecto"
        | "en_negociacion"
        | "activo"
        | "inactivo"
        | "perdido"
      estado_oportunidad: "en_proceso" | "ganada" | "perdida"
      tipo_cliente: "empresa" | "persona"
      tipo_interaccion:
        | "llamada"
        | "visita"
        | "reunion"
        | "whatsapp"
        | "correo"
        | "otro"
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
      cotizacion_estado: [
        "borrador",
        "enviada",
        "pendiente",
        "aceptada",
        "rechazada",
        "vencida",
      ],
      envio_estado: ["en_transito", "entregado", "devuelto", "anulado"],
      estado_cliente: [
        "prospecto",
        "en_negociacion",
        "activo",
        "inactivo",
        "perdido",
      ],
      estado_oportunidad: ["en_proceso", "ganada", "perdida"],
      tipo_cliente: ["empresa", "persona"],
      tipo_interaccion: [
        "llamada",
        "visita",
        "reunion",
        "whatsapp",
        "correo",
        "otro",
      ],
    },
  },
} as const

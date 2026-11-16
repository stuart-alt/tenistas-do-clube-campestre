
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "avisos": {
                  Row: {
                    "autor": string | null,"corpo_md": string,"created_at": string,"fixado": boolean,"id": string,"titulo": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "autor"?: string | null,"corpo_md": string,"created_at"?: string,"fixado"?: boolean,"id"?: string,"titulo": string,"updated_at"?: string
                  }
                  Update: {
                    "autor"?: string | null,"corpo_md"?: string,"created_at"?: string,"fixado"?: boolean,"id"?: string,"titulo"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "avisos_autor_fkey"
      columns: ["autor"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "avisos_autor_fkey"
      columns: ["autor"]
isOneToOne: false
      referencedRelation: "ranking"
      referencedColumns: ["jogador_id"]
    }
                  ]
                },"notificacoes": {
                  Row: {
                    "created_at": string,"id": string,"lida": boolean,"link": string | null,"texto": string,"tipo": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"lida"?: boolean,"link"?: string | null,"texto": string,"tipo": string,"usuario_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"lida"?: boolean,"link"?: string | null,"texto"?: string,"tipo"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notificacoes_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notificacoes_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "ranking"
      referencedColumns: ["jogador_id"]
    }
                  ]
                },"partida_jogadores": {
                  Row: {
                    "jogador_id": string,"lado": number,"partida_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "jogador_id": string,"lado": number,"partida_id": string
                  }
                  Update: {
                    "jogador_id"?: string,"lado"?: number,"partida_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "partida_jogadores_jogador_id_fkey"
      columns: ["jogador_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "partida_jogadores_jogador_id_fkey"
      columns: ["jogador_id"]
isOneToOne: false
      referencedRelation: "ranking"
      referencedColumns: ["jogador_id"]
    },{
      foreignKeyName: "partida_jogadores_partida_id_fkey"
      columns: ["partida_id"]
isOneToOne: false
      referencedRelation: "partidas"
      referencedColumns: ["id"]
    }
                  ]
                },"partida_sets": {
                  Row: {
                    "games_lado1": number,"games_lado2": number,"ordem": number,"partida_id": string,"super_tiebreak": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "games_lado1": number,"games_lado2": number,"ordem": number,"partida_id": string,"super_tiebreak"?: boolean
                  }
                  Update: {
                    "games_lado1"?: number,"games_lado2"?: number,"ordem"?: number,"partida_id"?: string,"super_tiebreak"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "partida_sets_partida_id_fkey"
      columns: ["partida_id"]
isOneToOne: false
      referencedRelation: "partidas"
      referencedColumns: ["id"]
    }
                  ]
                },"partidas": {
                  Row: {
                    "confirmado_em": string | null,"confirmado_por": string | null,"created_at": string,"data_jogo": string,"id": string,"lancado_por": string,"modalidade": string,"motivo_contestacao": string | null,"sala_id": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "confirmado_em"?: string | null,"confirmado_por"?: string | null,"created_at"?: string,"data_jogo": string,"id"?: string,"lancado_por": string,"modalidade": string,"motivo_contestacao"?: string | null,"sala_id"?: string | null,"status"?: string
                  }
                  Update: {
                    "confirmado_em"?: string | null,"confirmado_por"?: string | null,"created_at"?: string,"data_jogo"?: string,"id"?: string,"lancado_por"?: string,"modalidade"?: string,"motivo_contestacao"?: string | null,"sala_id"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "partidas_confirmado_por_fkey"
      columns: ["confirmado_por"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "partidas_confirmado_por_fkey"
      columns: ["confirmado_por"]
isOneToOne: false
      referencedRelation: "ranking"
      referencedColumns: ["jogador_id"]
    },{
      foreignKeyName: "partidas_lancado_por_fkey"
      columns: ["lancado_por"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "partidas_lancado_por_fkey"
      columns: ["lancado_por"]
isOneToOne: false
      referencedRelation: "ranking"
      referencedColumns: ["jogador_id"]
    },{
      foreignKeyName: "partidas_sala_id_fkey"
      columns: ["sala_id"]
isOneToOne: false
      referencedRelation: "salas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "partidas_sala_id_fkey"
      columns: ["sala_id"]
isOneToOne: false
      referencedRelation: "salas_lista"
      referencedColumns: ["id"]
    }
                  ]
                },"pontos_partida": {
                  Row: {
                    "bonus": number,"data_jogo": string,"jogador_id": string,"modalidade": string,"partida_id": string,"pontos": number,"vitoria": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "bonus": number,"data_jogo": string,"jogador_id": string,"modalidade": string,"partida_id": string,"pontos": number,"vitoria": boolean
                  }
                  Update: {
                    "bonus"?: number,"data_jogo"?: string,"jogador_id"?: string,"modalidade"?: string,"partida_id"?: string,"pontos"?: number,"vitoria"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "pontos_partida_jogador_id_fkey"
      columns: ["jogador_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pontos_partida_jogador_id_fkey"
      columns: ["jogador_id"]
isOneToOne: false
      referencedRelation: "ranking"
      referencedColumns: ["jogador_id"]
    },{
      foreignKeyName: "pontos_partida_partida_id_fkey"
      columns: ["partida_id"]
isOneToOne: false
      referencedRelation: "partidas"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "ativo": boolean,"backhand": number,"categoria": string | null,"created_at": string | null,"data_nascimento": string,"disponibilidade": (string)[],"email": string,"forehand": number,"foto_url": string | null,"genero": string | null,"id": string,"is_admin": boolean,"nome": string,"resistencia": number,"saque": number,"telefone": string,"velocidade": number,"voleio": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo"?: boolean,"backhand"?: number,"categoria"?: string | null,"created_at"?: string | null,"data_nascimento": string,"disponibilidade"?: (string)[],"email": string,"forehand"?: number,"foto_url"?: string | null,"genero"?: string | null,"id": string,"is_admin"?: boolean,"nome": string,"resistencia"?: number,"saque"?: number,"telefone": string,"velocidade"?: number,"voleio"?: number
                  }
                  Update: {
                    "ativo"?: boolean,"backhand"?: number,"categoria"?: string | null,"created_at"?: string | null,"data_nascimento"?: string,"disponibilidade"?: (string)[],"email"?: string,"forehand"?: number,"foto_url"?: string | null,"genero"?: string | null,"id"?: string,"is_admin"?: boolean,"nome"?: string,"resistencia"?: number,"saque"?: number,"telefone"?: string,"velocidade"?: number,"voleio"?: number
                  }
                  Relationships: [
                    
                  ]
                },"regras": {
                  Row: {
                    "bonus_pct": number,"bonus_teto": number,"janela_meses": number,"modalidade": string,"pts_game": number,"pts_set": number,"pts_vitoria": number
                  }
                  ComputedFields: never
                  Insert: {
                    "bonus_pct": number,"bonus_teto": number,"janela_meses": number,"modalidade": string,"pts_game": number,"pts_set": number,"pts_vitoria": number
                  }
                  Update: {
                    "bonus_pct"?: number,"bonus_teto"?: number,"janela_meses"?: number,"modalidade"?: string,"pts_game"?: number,"pts_set"?: number,"pts_vitoria"?: number
                  }
                  Relationships: [
                    
                  ]
                },"sala_vagas": {
                  Row: {
                    "jogador_id": string,"posicao": number,"sala_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "jogador_id": string,"posicao": number,"sala_id": string
                  }
                  Update: {
                    "jogador_id"?: string,"posicao"?: number,"sala_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sala_vagas_jogador_id_fkey"
      columns: ["jogador_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sala_vagas_jogador_id_fkey"
      columns: ["jogador_id"]
isOneToOne: false
      referencedRelation: "ranking"
      referencedColumns: ["jogador_id"]
    },{
      foreignKeyName: "sala_vagas_sala_id_fkey"
      columns: ["sala_id"]
isOneToOne: false
      referencedRelation: "salas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sala_vagas_sala_id_fkey"
      columns: ["sala_id"]
isOneToOne: false
      referencedRelation: "salas_lista"
      referencedColumns: ["id"]
    }
                  ]
                },"salas": {
                  Row: {
                    "created_at": string,"criador": string,"data_hora": string,"id": string,"modalidade": string,"partida_id": string | null,"recado": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"criador": string,"data_hora": string,"id"?: string,"modalidade": string,"partida_id"?: string | null,"recado"?: string | null,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"criador"?: string,"data_hora"?: string,"id"?: string,"modalidade"?: string,"partida_id"?: string | null,"recado"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "salas_criador_fkey"
      columns: ["criador"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "salas_criador_fkey"
      columns: ["criador"]
isOneToOne: false
      referencedRelation: "ranking"
      referencedColumns: ["jogador_id"]
    },{
      foreignKeyName: "salas_partida_id_fkey"
      columns: ["partida_id"]
isOneToOne: false
      referencedRelation: "partidas"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "ranking": {
                  Row: {
                    "categoria": string | null,"foto_url": string | null,"jogador_id": string,"modalidade": string,"nome": string,"partidas": number | null,"pontos": number | null,"posicao": number | null,"vitorias": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"salas_lista": {
                  Row: {
                    "created_at": string,"criador": string,"data_hora": string,"id": string,"modalidade": string,"partida_id": string | null,"recado": string | null,"status": string,"vagas": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                           "created_at"?: string | null,"criador"?: string | null,"data_hora"?: string | null,"id"?: string | null,"modalidade"?: string | null,"partida_id"?: string | null,"recado"?: string | null,"status"?: string | null,"vagas"?: never
                         }
                        Update: {
                           "created_at"?: string | null,"criador"?: string | null,"data_hora"?: string | null,"id"?: string | null,"modalidade"?: string | null,"partida_id"?: string | null,"recado"?: string | null,"status"?: string | null,"vagas"?: never
                         }
                        Relationships: [
                    {
      foreignKeyName: "salas_criador_fkey"
      columns: ["criador"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "salas_criador_fkey"
      columns: ["criador"]
isOneToOne: false
      referencedRelation: "ranking"
      referencedColumns: ["jogador_id"]
    },{
      foreignKeyName: "salas_partida_id_fkey"
      columns: ["partida_id"]
isOneToOne: false
      referencedRelation: "partidas"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "admin_cancelar_partida":
{ Args: { "p_id": string }; Returns: undefined
                           },
"admin_corrigir_partida":
{ Args: { "p_data_jogo": string,"p_id": string,"p_sets": Json }; Returns: undefined
                           },
"atualizar_regras":
{ Args: { "p_bonus_pct": number,"p_bonus_teto": number,"p_janela_meses": number,"p_modalidade": string,"p_pts_game": number,"p_pts_set": number,"p_pts_vitoria": number }; Returns: undefined
                           },
"auto_confirmar_partidas":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"cancelar_sala":
{ Args: { "p_sala": string }; Returns: undefined
                           },
"confirmar_partida":
{ Args: { "p_id": string }; Returns: undefined
                           },
"contestar_partida":
{ Args: { "p_id": string,"p_motivo": string }; Returns: undefined
                           },
"criar_sala":
{ Args: { "p_data_hora": string,"p_modalidade": string,"p_posicao": number,"p_recado": string }; Returns: string
                           },
"definir_ativo":
{ Args: { "p_ativo": boolean,"p_jogador": string }; Returns: undefined
                           },
"entrar_sala":
{ Args: { "p_posicao": number,"p_sala": string }; Returns: undefined
                           },
"hoje":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"notificar":
{ Args: { "p_link": string,"p_texto": string,"p_tipo": string,"p_usuario": string }; Returns: undefined
                           },
"notificar_jogadores_partida":
{ Args: { "p_exceto": string,"p_link": string,"p_partida": string,"p_texto": string,"p_tipo": string }; Returns: undefined
                           },
"notificar_sala":
{ Args: { "p_exceto": string,"p_sala": string,"p_texto": string,"p_tipo": string }; Returns: undefined
                           },
"pontos_expirando":
{ Args: { "p_dias"?: number,"p_jogador": string,"p_modalidade": string }; Returns: {
              "expira_em": string,"pontos": number
            }[]
                           },
"recalcular_ranking":
{ Args: { "p_modalidade": string }; Returns: undefined
                           },
"registrar_partida":
{ Args: { "p_data_jogo": string,"p_lado1": (string)[],"p_lado2": (string)[],"p_modalidade": string,"p_sala_id"?: string,"p_sets": Json }; Returns: string
                           },
"sair_sala":
{ Args: { "p_sala": string }; Returns: undefined
                           },
"sala_total_vagas":
{ Args: { "p_modalidade": string }; Returns: number
                           },
"validar_sets":
{ Args: { "p_sets": Json }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const

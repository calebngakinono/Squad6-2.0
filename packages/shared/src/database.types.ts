
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
            "onboarding_flows": {
                  Row: {
                    "active": boolean,"created_at": string,"definition": NonNullable<Json>,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"definition": NonNullable<Json>,"version": number
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"definition"?: NonNullable<Json>,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"points_ledger": {
                  Row: {
                    "created_at": string,"id": number,"kind": string,"local_date": string,"points": number,"reason": string,"revision": number,"rule_version": string,"season": number,"source_id": string,"source_type": string,"squad_id": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"kind": string,"local_date": string,"points": number,"reason": string,"revision"?: number,"rule_version": string,"season": number,"source_id": string,"source_type": string,"squad_id"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"kind"?: string,"local_date"?: string,"points"?: number,"reason"?: string,"revision"?: number,"rule_version"?: string,"season"?: number,"source_id"?: string,"source_type"?: string,"squad_id"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "points_ledger_rule_version_fkey"
      columns: ["rule_version"]
isOneToOne: false
      referencedRelation: "scoring_rule_versions"
      referencedColumns: ["version"]
    },{
      foreignKeyName: "points_ledger_squad_id_fkey"
      columns: ["squad_id"]
isOneToOne: false
      referencedRelation: "squads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "points_ledger_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_private": {
                  Row: {
                    "created_at": string,"home_timezone": string | null,"home_timezone_changed_at": string | null,"onboarding_answers": NonNullable<Json>,"onboarding_completed_at": string | null,"onboarding_flow_version": number | null,"onboarding_step": string | null,"updated_at": string,"user_id": string,"weekly_commitment": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"home_timezone"?: string | null,"home_timezone_changed_at"?: string | null,"onboarding_answers"?: NonNullable<Json>,"onboarding_completed_at"?: string | null,"onboarding_flow_version"?: number | null,"onboarding_step"?: string | null,"updated_at"?: string,"user_id": string,"weekly_commitment"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"home_timezone"?: string | null,"home_timezone_changed_at"?: string | null,"onboarding_answers"?: NonNullable<Json>,"onboarding_completed_at"?: string | null,"onboarding_flow_version"?: number | null,"onboarding_step"?: string | null,"updated_at"?: string,"user_id"?: string,"weekly_commitment"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_private_onboarding_flow_version_fkey"
      columns: ["onboarding_flow_version"]
isOneToOne: false
      referencedRelation: "onboarding_flows"
      referencedColumns: ["version"]
    },{
      foreignKeyName: "profile_private_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "city": string | null,"created_at": string,"display_name": string | null,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "city"?: string | null,"created_at"?: string,"display_name"?: string | null,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "city"?: string | null,"created_at"?: string,"display_name"?: string | null,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"scoring_rule_versions": {
                  Row: {
                    "active_from": string | null,"config": NonNullable<Json>,"created_at": string,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active_from"?: string | null,"config": NonNullable<Json>,"created_at"?: string,"version": string
                  }
                  Update: {
                    "active_from"?: string | null,"config"?: NonNullable<Json>,"created_at"?: string,"version"?: string
                  }
                  Relationships: [
                    
                  ]
                },"squad_invite_codes": {
                  Row: {
                    "code": string,"created_at": string,"squad_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"squad_id": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"squad_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "squad_invite_codes_squad_id_fkey"
      columns: ["squad_id"]
isOneToOne: true
      referencedRelation: "squads"
      referencedColumns: ["id"]
    }
                  ]
                },"squad_join_requests": {
                  Row: {
                    "created_at": string,"decided_at": string | null,"decided_by": string | null,"id": string,"squad_id": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"squad_id": string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"squad_id"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "squad_join_requests_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "squad_join_requests_squad_id_fkey"
      columns: ["squad_id"]
isOneToOne: false
      referencedRelation: "squads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "squad_join_requests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"squad_members": {
                  Row: {
                    "id": string,"joined_at": string,"left_at": string | null,"left_reason": string | null,"role": string,"squad_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"joined_at"?: string,"left_at"?: string | null,"left_reason"?: string | null,"role"?: string,"squad_id": string,"user_id": string
                  }
                  Update: {
                    "id"?: string,"joined_at"?: string,"left_at"?: string | null,"left_reason"?: string | null,"role"?: string,"squad_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "squad_members_squad_id_fkey"
      columns: ["squad_id"]
isOneToOne: false
      referencedRelation: "squads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "squad_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"squads": {
                  Row: {
                    "archived_at": string | null,"city": string,"created_at": string,"created_by": string | null,"description": string | null,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"city": string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"name": string
                  }
                  Update: {
                    "archived_at"?: string | null,"city"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "squads_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"strength_sets": {
                  Row: {
                    "after_finish": boolean,"client_at": string | null,"client_set_id": string,"deleted_at": string | null,"effective_at": string,"exercise": string,"id": string,"offline": boolean,"reps": number,"server_at": string,"session_id": string,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "after_finish"?: boolean,"client_at"?: string | null,"client_set_id": string,"deleted_at"?: string | null,"effective_at": string,"exercise": string,"id"?: string,"offline"?: boolean,"reps": number,"server_at"?: string,"session_id": string,"weight_kg"?: number | null
                  }
                  Update: {
                    "after_finish"?: boolean,"client_at"?: string | null,"client_set_id"?: string,"deleted_at"?: string | null,"effective_at"?: string,"exercise"?: string,"id"?: string,"offline"?: boolean,"reps"?: number,"server_at"?: string,"session_id"?: string,"weight_kg"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "strength_sets_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "workout_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"workout_evidence": {
                  Row: {
                    "activity": string | null,"device_name": string | null,"distance_m": number | null,"ended_at": string,"energy_kcal": number | null,"external_record_id": string,"hr_avg": number | null,"hr_max": number | null,"hr_min": number | null,"hr_minutes": number | null,"hr_samples": number | null,"id": string,"overlap": number,"provider": string,"received_at": string,"session_id": string,"source_bundle_id": string,"source_name": string | null,"started_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity"?: string | null,"device_name"?: string | null,"distance_m"?: number | null,"ended_at": string,"energy_kcal"?: number | null,"external_record_id": string,"hr_avg"?: number | null,"hr_max"?: number | null,"hr_min"?: number | null,"hr_minutes"?: number | null,"hr_samples"?: number | null,"id"?: string,"overlap": number,"provider": string,"received_at"?: string,"session_id": string,"source_bundle_id": string,"source_name"?: string | null,"started_at": string
                  }
                  Update: {
                    "activity"?: string | null,"device_name"?: string | null,"distance_m"?: number | null,"ended_at"?: string,"energy_kcal"?: number | null,"external_record_id"?: string,"hr_avg"?: number | null,"hr_max"?: number | null,"hr_min"?: number | null,"hr_minutes"?: number | null,"hr_samples"?: number | null,"id"?: string,"overlap"?: number,"provider"?: string,"received_at"?: string,"session_id"?: string,"source_bundle_id"?: string,"source_name"?: string | null,"started_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_evidence_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "workout_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"workout_metrics": {
                  Row: {
                    "computed_at": string,"metric": string,"provenance": string,"session_id": string,"source": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "computed_at"?: string,"metric": string,"provenance": string,"session_id": string,"source": string,"value": number
                  }
                  Update: {
                    "computed_at"?: string,"metric"?: string,"provenance"?: string,"session_id"?: string,"source"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_metrics_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "workout_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"workout_motion_samples": {
                  Row: {
                    "bucket_start": string,"received_at": string,"seconds": number,"session_id": string,"steps": number
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_start": string,"received_at"?: string,"seconds": number,"session_id": string,"steps": number
                  }
                  Update: {
                    "bucket_start"?: string,"received_at"?: string,"seconds"?: number,"session_id"?: string,"steps"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_motion_samples_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "workout_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"workout_reviews": {
                  Row: {
                    "decided_at": string,"decision": string,"id": number,"reason": string,"reviewer": string,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "decided_at"?: string,"decision": string,"id"?: never,"reason": string,"reviewer": string,"session_id": string
                  }
                  Update: {
                    "decided_at"?: string,"decision"?: string,"id"?: never,"reason"?: string,"reviewer"?: string,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_reviews_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "workout_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"workout_route_points": {
                  Row: {
                    "accuracy_m": number | null,"altitude_m": number | null,"latitude": number,"longitude": number,"mocked": boolean,"received_at": string,"recorded_at": string,"session_id": string,"speed_ms": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accuracy_m"?: number | null,"altitude_m"?: number | null,"latitude": number,"longitude": number,"mocked"?: boolean,"received_at"?: string,"recorded_at": string,"session_id": string,"speed_ms"?: number | null
                  }
                  Update: {
                    "accuracy_m"?: number | null,"altitude_m"?: number | null,"latitude"?: number,"longitude"?: number,"mocked"?: boolean,"received_at"?: string,"recorded_at"?: string,"session_id"?: string,"speed_ms"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_route_points_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "workout_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"workout_scores": {
                  Row: {
                    "base": number,"categories": (string)[],"detail": NonNullable<Json>,"factor": number,"merged_into": string | null,"performance": number,"rule_version": string,"scored_at": string,"session_id": string,"status": string,"total": number,"verification": number
                  }
                  ComputedFields: never
                  Insert: {
                    "base"?: number,"categories"?: (string)[],"detail"?: NonNullable<Json>,"factor"?: number,"merged_into"?: string | null,"performance"?: number,"rule_version": string,"scored_at"?: string,"session_id": string,"status": string,"total"?: number,"verification"?: number
                  }
                  Update: {
                    "base"?: number,"categories"?: (string)[],"detail"?: NonNullable<Json>,"factor"?: number,"merged_into"?: string | null,"performance"?: number,"rule_version"?: string,"scored_at"?: string,"session_id"?: string,"status"?: string,"total"?: number,"verification"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_scores_merged_into_fkey"
      columns: ["merged_into"]
isOneToOne: false
      referencedRelation: "workout_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_scores_rule_version_fkey"
      columns: ["rule_version"]
isOneToOne: false
      referencedRelation: "scoring_rule_versions"
      referencedColumns: ["version"]
    },{
      foreignKeyName: "workout_scores_session_id_fkey"
      columns: ["session_id"]
isOneToOne: true
      referencedRelation: "workout_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"workout_session_events": {
                  Row: {
                    "client_at": string | null,"client_event_id": string,"device_id": string | null,"effective_at": string,"id": number,"kind": string,"offline": boolean,"server_at": string,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_at"?: string | null,"client_event_id": string,"device_id"?: string | null,"effective_at": string,"id"?: never,"kind": string,"offline"?: boolean,"server_at"?: string,"session_id": string
                  }
                  Update: {
                    "client_at"?: string | null,"client_event_id"?: string,"device_id"?: string | null,"effective_at"?: string,"id"?: never,"kind"?: string,"offline"?: boolean,"server_at"?: string,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_session_events_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "workout_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"workout_sessions": {
                  Row: {
                    "active_seconds": number | null,"activity": string,"client_session_id": string,"created_at": string,"device_id": string | null,"ended_at": string | null,"home_timezone": string,"id": string,"local_date": string,"squad_id": string | null,"started_at": string,"started_offline": boolean,"state": string,"user_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active_seconds"?: number | null,"activity": string,"client_session_id": string,"created_at"?: string,"device_id"?: string | null,"ended_at"?: string | null,"home_timezone": string,"id"?: string,"local_date": string,"squad_id"?: string | null,"started_at": string,"started_offline"?: boolean,"state"?: string,"user_id": string,"version"?: number
                  }
                  Update: {
                    "active_seconds"?: number | null,"activity"?: string,"client_session_id"?: string,"created_at"?: string,"device_id"?: string | null,"ended_at"?: string | null,"home_timezone"?: string,"id"?: string,"local_date"?: string,"squad_id"?: string | null,"started_at"?: string,"started_offline"?: boolean,"state"?: string,"user_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_sessions_squad_id_fkey"
      columns: ["squad_id"]
isOneToOne: false
      referencedRelation: "squads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_sessions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "workouts_awaiting_review": {
                  Row: {
                    "active_minutes": number | null,"activity": string,"athlete": string | null,"flagged_at": string,"flagged_because": string | null,"gps_coverage": number | null,"gps_km": number | null,"gps_km_thrown_out": number | null,"health_app_source": string | null,"local_date": string,"session_id": string,"steps": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "workout_scores_session_id_fkey"
      columns: ["session_id"]
isOneToOne: true
      referencedRelation: "workout_sessions"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "add_motion_samples":
{ Args: { "samples": Json,"session_id": string }; Returns: number
                           },
"add_route_points":
{ Args: { "points": Json,"session_id": string }; Returns: number
                           },
"attach_workout_evidence":
{ Args: { "evidence": Json,"session_id": string }; Returns: {
              "activity": string | null,
"device_name": string | null,
"distance_m": number | null,
"ended_at": string,
"energy_kcal": number | null,
"external_record_id": string,
"hr_avg": number | null,
"hr_max": number | null,
"hr_min": number | null,
"hr_minutes": number | null,
"hr_samples": number | null,
"id": string,
"overlap": number,
"provider": string,
"received_at": string,
"session_id": string,
"source_bundle_id": string,
"source_name": string | null,
"started_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "workout_evidence"
        isOneToOne: true
        isSetofReturn: false
      } },
"cancel_join_request":
{ Args: { "request_id": string }; Returns: undefined
                           },
"cancel_workout":
{ Args: { "client_at"?: string,"client_event_id": string,"device_id"?: string,"expected_version": number,"session_id": string }; Returns: {
              "active_seconds": number | null,
"activity": string,
"client_session_id": string,
"created_at": string,
"device_id": string | null,
"ended_at": string | null,
"home_timezone": string,
"id": string,
"local_date": string,
"squad_id": string | null,
"started_at": string,
"started_offline": boolean,
"state": string,
"user_id": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "workout_sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"complete_onboarding":
{ Args: { "answers": Json,"city": string,"display_name": string,"flow_version": number,"home_timezone": string,"weekly_commitment": number }; Returns: undefined
                           },
"create_squad":
{ Args: { "squad_city": string,"squad_description"?: string,"squad_name": string }; Returns: string
                           },
"decide_join_request":
{ Args: { "approve": boolean,"request_id": string }; Returns: undefined
                           },
"delete_strength_set":
{ Args: { "session_id": string,"set_id": string }; Returns: undefined
                           },
"end_membership":
{ Args: { "member_user": string,"reason": string }; Returns: undefined
                           },
"expire_stale_workouts":
{ Args: { "target_user": string }; Returns: undefined
                           },
"finish_workout":
{ Args: { "client_at"?: string,"client_event_id": string,"device_id"?: string,"expected_version": number,"session_id": string }; Returns: {
              "active_seconds": number | null,
"activity": string,
"client_session_id": string,
"created_at": string,
"device_id": string | null,
"ended_at": string | null,
"home_timezone": string,
"id": string,
"local_date": string,
"squad_id": string | null,
"started_at": string,
"started_offline": boolean,
"state": string,
"user_id": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "workout_sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"generate_invite_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"geo_distance_m":
{ Args: { "lat1": number,"lat2": number,"lng1": number,"lng2": number }; Returns: number
                           },
"get_open_workout":
{ Args: Record<PropertyKey, never>; Returns: {
              "active_seconds": number | null,
"activity": string,
"client_session_id": string,
"created_at": string,
"device_id": string | null,
"ended_at": string | null,
"home_timezone": string,
"id": string,
"local_date": string,
"squad_id": string | null,
"started_at": string,
"started_offline": boolean,
"state": string,
"user_id": string,
"version": number
            }[]
                          SetofOptions: {
        from: "*"
        to: "workout_sessions"
        isOneToOne: false
        isSetofReturn: true
      } },
"is_squad_captain":
{ Args: { "target_squad": string }; Returns: boolean
                           },
"is_squad_member":
{ Args: { "target_squad": string }; Returns: boolean
                           },
"leave_squad":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"log_strength_set":
{ Args: { "client_at"?: string,"client_set_id": string,"exercise": string,"reps": number,"session_id": string,"weight_kg"?: number }; Returns: {
              "after_finish": boolean,
"client_at": string | null,
"client_set_id": string,
"deleted_at": string | null,
"effective_at": string,
"exercise": string,
"id": string,
"offline": boolean,
"reps": number,
"server_at": string,
"session_id": string,
"weight_kg": number | null
            }
                          SetofOptions: {
        from: "*"
        to: "strength_sets"
        isOneToOne: true
        isSetofReturn: false
      } },
"pause_workout":
{ Args: { "client_at"?: string,"client_event_id": string,"device_id"?: string,"expected_version": number,"session_id": string }; Returns: {
              "active_seconds": number | null,
"activity": string,
"client_session_id": string,
"created_at": string,
"device_id": string | null,
"ended_at": string | null,
"home_timezone": string,
"id": string,
"local_date": string,
"squad_id": string | null,
"started_at": string,
"started_offline": boolean,
"state": string,
"user_id": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "workout_sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"preview_squad":
{ Args: { "invite_code": string }; Returns: {
              "city": string,"is_full": boolean,"member_count": number,"name": string,"squad_id": string
            }[]
                           },
"refresh_workout_metrics":
{ Args: { "target": string }; Returns: undefined
                           },
"regenerate_invite_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"remove_squad_member":
{ Args: { "member_user": string }; Returns: undefined
                           },
"request_to_join":
{ Args: { "invite_code": string }; Returns: string
                           },
"require_user":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"require_user_uid":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"resume_workout":
{ Args: { "client_at"?: string,"client_event_id": string,"device_id"?: string,"expected_version": number,"session_id": string }; Returns: {
              "active_seconds": number | null,
"activity": string,
"client_session_id": string,
"created_at": string,
"device_id": string | null,
"ended_at": string | null,
"home_timezone": string,
"id": string,
"local_date": string,
"squad_id": string | null,
"started_at": string,
"started_offline": boolean,
"state": string,
"user_id": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "workout_sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"review_workout":
{ Args: { "decision": string,"reason": string,"reviewer": string,"target": string }; Returns: {
              "base": number,
"categories": (string)[],
"detail": NonNullable<Json>,
"factor": number,
"merged_into": string | null,
"performance": number,
"rule_version": string,
"scored_at": string,
"session_id": string,
"status": string,
"total": number,
"verification": number
            }
                          SetofOptions: {
        from: "*"
        to: "workout_scores"
        isOneToOne: true
        isSetofReturn: false
      } },
"save_onboarding_progress":
{ Args: { "answers": Json,"current_step": string,"flow_version": number }; Returns: undefined
                           },
"score_day":
{ Args: { "target_date": string,"target_user": string }; Returns: undefined
                           },
"score_workout_day":
{ Args: { "target": string }; Returns: undefined
                           },
"scoring_performance":
{ Args: { "active_seconds": number,"activity": string,"cfg": Json,"distance_m": number,"live_sets": number }; Returns: Record<string, unknown>
                           },
"scoring_ramp":
{ Args: { "full_at": number,"x": number,"zero": number }; Returns: number
                           },
"set_home_timezone":
{ Args: { "tz": string }; Returns: undefined
                           },
"set_scoring_active":
{ Args: { "starting": string,"target_version": string }; Returns: undefined
                           },
"start_workout":
{ Args: { "activity": string,"client_session_id": string,"client_started_at"?: string,"device_id"?: string }; Returns: {
              "active_seconds": number | null,
"activity": string,
"client_session_id": string,
"created_at": string,
"device_id": string | null,
"ended_at": string | null,
"home_timezone": string,
"id": string,
"local_date": string,
"squad_id": string | null,
"started_at": string,
"started_offline": boolean,
"state": string,
"user_id": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "workout_sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"transfer_captaincy":
{ Args: { "new_captain": string }; Returns: undefined
                           },
"workout_active_intervals":
{ Args: { "target": string }; Returns: {
              "from_at": string,"to_at": string
            }[]
                           },
"workout_active_seconds":
{ Args: { "target": string,"until"?: string }; Returns: number
                           },
"workout_clamp":
{ Args: { "client_at": string,"lower_bound": string }; Returns: Record<string, unknown>
                           },
"workout_for_tracking":
{ Args: { "target": string }; Returns: {
              "active_seconds": number | null,
"activity": string,
"client_session_id": string,
"created_at": string,
"device_id": string | null,
"ended_at": string | null,
"home_timezone": string,
"id": string,
"local_date": string,
"squad_id": string | null,
"started_at": string,
"started_offline": boolean,
"state": string,
"user_id": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "workout_sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"workout_max_open":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"workout_scoring_facts":
{ Args: { "cfg": Json,"target": string }; Returns: Json
                           },
"workout_transition":
{ Args: { "client_at": string,"client_event_id": string,"device_id": string,"expected_version": number,"kind": string,"session_id": string }; Returns: {
              "active_seconds": number | null,
"activity": string,
"client_session_id": string,
"created_at": string,
"device_id": string | null,
"ended_at": string | null,
"home_timezone": string,
"id": string,
"local_date": string,
"squad_id": string | null,
"started_at": string,
"started_offline": boolean,
"state": string,
"user_id": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "workout_sessions"
        isOneToOne: true
        isSetofReturn: false
      } }
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

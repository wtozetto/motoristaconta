export type UserRole = 'admin' | 'driver'
export type SubscriptionStatus = 'active' | 'pending' | 'canceled' | 'suspended' | 'trial'
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'expired'
export type ReminderType = 'oil_change' | 'ipva' | 'licensing' | 'insurance' | 'custom'

export interface Plan {
  id: string
  name: string
  description: string | null
  price: number
  period_days: number
  features: string[]
  is_active: boolean
}

export interface Subscription {
  id: string
  user_id: string
  plan_id: string
  status: SubscriptionStatus
  start_date: string
  next_billing_date: string | null
  canceled_at: string | null
  plans?: Pick<Plan, 'name' | 'price'>[]
  profiles?: { name: string | null; email: string | null }[]
}

export interface Payment {
  id: string
  subscription_id: string
  user_id: string
  amount: number
  status: PaymentStatus
  payment_date: string | null
  due_date: string
  invoice_url: string | null
  profiles?: { name: string | null; email: string | null }[]
}

export interface DriverReminder {
  id: string
  user_id: string
  type: ReminderType
  title: string
  description: string | null
  due_date: string
  repeat_days: number | null
  notify_days_before: number
  is_active: boolean
}

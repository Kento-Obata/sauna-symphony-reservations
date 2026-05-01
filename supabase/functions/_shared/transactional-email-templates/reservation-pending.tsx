/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '体験型サウナU'

interface Props {
  guestName?: string
  reservationCode?: string
  date?: string
  timeSlot?: string
  guestCount?: number
  totalPrice?: number
  confirmationUrl?: string
}

const ReservationPendingEmail = ({
  guestName,
  reservationCode,
  date,
  timeSlot,
  guestCount,
  totalPrice,
  confirmationUrl,
}: Props) => (
  <Html lang="ja">
    <Head />
    <Preview>仮予約を受け付けました。2時間以内にご確認ください。</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>仮予約を受け付けました</Heading>
        <Text style={text}>{guestName ? `${guestName} 様` : 'お客様'}</Text>
        <Text style={text}>
          {SITE_NAME} のご予約ありがとうございます。<br />
          下記ボタンより最終確認をお願いいたします。<strong>本リンクは2時間有効です。</strong>
        </Text>

        {confirmationUrl && (
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={confirmationUrl} style={button}>予約を確定する</Button>
          </Section>
        )}

        <Section style={card}>
          <Text style={cardLabel}>予約コード</Text>
          <Text style={cardValue}>{reservationCode}</Text>
          <Text style={cardLabel}>日付</Text>
          <Text style={cardValue}>{date}</Text>
          <Text style={cardLabel}>時間</Text>
          <Text style={cardValue}>{timeSlot}</Text>
          <Text style={cardLabel}>人数</Text>
          <Text style={cardValue}>{guestCount} 名様</Text>
          {typeof totalPrice === 'number' && (
            <>
              <Text style={cardLabel}>料金</Text>
              <Text style={cardValue}>¥{totalPrice.toLocaleString()}（税込）</Text>
            </>
          )}
        </Section>

        <Text style={muted}>
          設備：タオル、水着、シャンプー・リンス・ボディソープ、フェイシャルパック、化粧水・乳液、ヘアオイル、ドライヤー、各種アイロンをご用意しております。
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ReservationPendingEmail,
  subject: 'サウナのご仮予約確認',
  displayName: '仮予約確認',
  previewData: {
    guestName: '山田 太郎',
    reservationCode: 'ABCD1234',
    date: '2026-05-20',
    timeSlot: '12:00-14:30',
    guestCount: 2,
    totalPrice: 12000,
    confirmationUrl: 'https://www.u-sauna-private.com/reservation/confirm/xxx',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '"Helvetica Neue", Arial, sans-serif' }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#2d3a26', margin: '0 0 24px' }
const text = { fontSize: '14px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 16px' }
const muted = { fontSize: '12px', color: '#888', lineHeight: '1.6', margin: '24px 0 0' }
const button = {
  backgroundColor: '#2d3a26',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 'bold',
}
const card = { backgroundColor: '#f5f5f0', padding: '20px', borderRadius: '8px', margin: '16px 0' }
const cardLabel = { fontSize: '11px', color: '#888', margin: '8px 0 2px', textTransform: 'uppercase' as const }
const cardValue = { fontSize: '14px', color: '#2d3a26', margin: '0 0 8px', fontWeight: 'bold' }

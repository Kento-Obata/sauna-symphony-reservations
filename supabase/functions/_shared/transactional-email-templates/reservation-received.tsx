/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '体験型サウナU'

interface Props {
  guestName?: string
  reservationCode?: string
  date?: string
  timeSlot?: string
  guestCount?: number
  reservationUrl?: string
}

const ReservationReceivedEmail = ({
  guestName,
  reservationCode,
  date,
  timeSlot,
  guestCount,
  reservationUrl,
}: Props) => (
  <Html lang="ja">
    <Head />
    <Preview>ご予約を受け付けました。</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>ご予約ありがとうございます</Heading>
        <Text style={text}>{guestName ? `${guestName} 様` : 'お客様'}</Text>
        <Text style={text}>
          {SITE_NAME} のご予約を受け付けました。
        </Text>

        <Section style={card}>
          <Text style={cardLabel}>予約コード</Text>
          <Text style={cardValue}>{reservationCode}</Text>
          <Text style={cardLabel}>日付</Text>
          <Text style={cardValue}>{date}</Text>
          <Text style={cardLabel}>時間</Text>
          <Text style={cardValue}>{timeSlot}</Text>
          <Text style={cardLabel}>人数</Text>
          <Text style={cardValue}>{guestCount} 名様</Text>
        </Section>

        {reservationUrl && (
          <Text style={text}>
            予約詳細：<Link href={reservationUrl} style={link}>{reservationUrl}</Link>
          </Text>
        )}

        <Text style={text}>
          住所：〒811-2127 福岡県糟屋郡宇美町障子岳6-8-4<br />
          <Link href="https://maps.google.com/maps?q=8Q5GHG7V%2BJ5" style={link}>Google Maps</Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ReservationReceivedEmail,
  subject: 'ご予約を受け付けました',
  displayName: '予約受付',
  previewData: {
    guestName: '山田 太郎',
    reservationCode: 'ABCD1234',
    date: '2026-05-20',
    timeSlot: '12:00-14:30',
    guestCount: 2,
    reservationUrl: 'https://www.u-sauna-private.com/reservation/ABCD1234',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '"Helvetica Neue", Arial, sans-serif' }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#2d3a26', margin: '0 0 24px' }
const text = { fontSize: '14px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 12px' }
const link = { color: '#2d3a26', textDecoration: 'underline' }
const card = { backgroundColor: '#f5f5f0', padding: '20px', borderRadius: '8px', margin: '16px 0' }
const cardLabel = { fontSize: '11px', color: '#888', margin: '8px 0 2px', textTransform: 'uppercase' as const }
const cardValue = { fontSize: '14px', color: '#2d3a26', margin: '0 0 8px', fontWeight: 'bold' }

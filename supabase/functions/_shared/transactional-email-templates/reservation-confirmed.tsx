/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
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
  reservationUrl?: string
}

const ReservationConfirmedEmail = ({
  guestName,
  reservationCode,
  date,
  timeSlot,
  guestCount,
  totalPrice,
  reservationUrl,
}: Props) => (
  <Html lang="ja">
    <Head />
    <Preview>ご予約が確定しました。当日お待ちしております。</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>ご予約が確定しました</Heading>
        <Text style={text}>{guestName ? `${guestName} 様` : 'お客様'}</Text>
        <Text style={text}>
          {SITE_NAME} のご予約をいただきありがとうございます。<br />
          当日、心よりお待ちしております。
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
          {typeof totalPrice === 'number' && (
            <>
              <Text style={cardLabel}>料金</Text>
              <Text style={cardValue}>¥{totalPrice.toLocaleString()}（税込）</Text>
            </>
          )}
        </Section>

        {reservationUrl && (
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={reservationUrl} style={button}>予約内容を確認・変更</Button>
          </Section>
        )}

        <Hr style={{ borderColor: '#e0e0d8', margin: '24px 0' }} />

        <Heading as="h2" style={h2}>受付時間</Heading>
        <Text style={text}>ご予約時間の10分前からご案内いたします。</Text>

        <Heading as="h2" style={h2}>アクセス</Heading>
        <Text style={text}>
          〒811-2127 福岡県糟屋郡宇美町障子岳6-8-4<br />
          Plus Code: 8Q5GHG7V+J5<br />
          <Link href="https://maps.google.com/maps?q=8Q5GHG7V%2BJ5" style={link}>Google Maps で開く</Link>
        </Text>

        <Heading as="h2" style={h2}>遅刻時の事前連絡</Heading>
        <Text style={text}>
          電話: 090-9370-2960 / Instagram DM
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ReservationConfirmedEmail,
  subject: 'ご予約確定のお知らせ',
  displayName: '予約確定',
  previewData: {
    guestName: '山田 太郎',
    reservationCode: 'ABCD1234',
    date: '2026-05-20',
    timeSlot: '12:00-14:30',
    guestCount: 2,
    totalPrice: 12000,
    reservationUrl: 'https://www.u-sauna-private.com/reservation/ABCD1234',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '"Helvetica Neue", Arial, sans-serif' }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#2d3a26', margin: '0 0 24px' }
const h2 = { fontSize: '15px', fontWeight: 'bold', color: '#2d3a26', margin: '20px 0 8px' }
const text = { fontSize: '14px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 12px' }
const link = { color: '#2d3a26', textDecoration: 'underline' }
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

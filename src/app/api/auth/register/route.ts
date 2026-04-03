import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { outletName, ownerName, email, password, accountType } = body;

    // Validate required fields
    if (!outletName || !ownerName || !email || !password) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Determine account type (always default to "free")
    const finalAccountType = 'free';

    // Create outlet + owner in transaction
    const result = await db.$transaction(async (tx) => {
      const outlet = await tx.outlet.create({
        data: {
          name: outletName,
          accountType: finalAccountType,
        },
      });

      // Create default outlet settings
      await tx.outletSetting.create({
        data: {
          outletId: outlet.id,
          paymentMethods: 'CASH,QRIS',
          loyaltyEnabled: true,
          loyaltyPointsPerAmount: 10000,
          loyaltyPointValue: 100,
          receiptBusinessName: outletName,
          receiptAddress: '',
          receiptPhone: '',
          receiptFooter: 'Terima kasih atas kunjungan Anda!',
          receiptLogo: '',
          themePrimaryColor: 'emerald',
        },
      });

      const user = await tx.user.create({
        data: {
          name: ownerName,
          email,
          password: hashedPassword,
          role: 'OWNER',
          outletId: outlet.id,
        },
      });

      return { outlet, user };
    });

    return NextResponse.json(
      {
        message: 'Registration successful',
        outletId: result.outlet.id,
        userId: result.user.id,
        accountType: finalAccountType,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

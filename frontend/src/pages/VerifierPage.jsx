import React, { useState } from 'react'

const VerifierPage = () => {
  const [result, setResult] = useState(null)
  const [fileName, setFileName] = useState('')
  const [verifyType, setVerifyType] = useState('vc') // 'vc' or 'vp'

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    setFileName(file.name)
    setResult(null)

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)

      const endpoint =
        verifyType === 'vp'
          ? 'http://localhost:5001/api/verify_presentation'
          : 'http://localhost:5001/api/verify_vc'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed)
      })

      const data = await response.json()
      setResult(data.verified ? true : false)
    } catch (err) {
      console.error('Verification failed:', err)
      setResult(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-lg">
        <h2 className="text-xl font-bold mb-4">🔎 Verifier Portal</h2>

        <div className="mb-4">
          <label className="mr-4">
            <input
              type="radio"
              name="verifyType"
              value="vc"
              checked={verifyType === 'vc'}
              onChange={() => setVerifyType('vc')}
              className="mr-1"
            />
            Verifiable Credential (VC)
          </label>
          <label>
            <input
              type="radio"
              name="verifyType"
              value="vp"
              checked={verifyType === 'vp'}
              onChange={() => setVerifyType('vp')}
              className="mr-1"
            />
            Verifiable Presentation (VP)
          </label>
        </div>

        <input
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          className="mb-4"
        />
        {fileName && <p className="text-sm text-gray-600 mb-4">Loaded: {fileName}</p>}

        {result !== null && (
          <div
            className={`mt-4 p-3 rounded ${
              result ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {result ? '✅ Verification Successful' : '❌ Verification Failed'}
          </div>
        )}
      </div>
    </div>
  )
}

export default VerifierPage

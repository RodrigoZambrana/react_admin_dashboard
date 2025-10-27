"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import cogoToast from "cogo-toast"
import { Container, Row, Col } from "react-bootstrap"
import { ContentWrapperOne as ContentWrapper } from "@components/wrapper"
import Breadcrumb from "@components/ui/breadcrumb"
import { StorefrontApi, isApiError } from "@/lib/api/storefront"
import { looksLikePhoneNumber, normalizePhoneNumber } from "@/lib/utils/phone"

const LoginClient = () => {
  const router = useRouter()
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!identifier.trim() || !password) {
      setError("Please enter your email or phone number and password.")
      return
    }
    setError(null)
    setLoading(true)
    try {
      let loginIdentifier = identifier.trim()
      if (looksLikePhoneNumber(loginIdentifier)) {
        const normalized = normalizePhoneNumber(loginIdentifier)
        if (!normalized) {
          setError("Please enter a valid phone number.")
          return
        }
        loginIdentifier = normalized
      }
      const session = await StorefrontApi.login(loginIdentifier, password)
      if (typeof window !== "undefined") {
        window.localStorage.setItem("storefrontSession", JSON.stringify(session))
      }
      cogoToast.success("Welcome back!", {
        position: "bottom-right",
        heading: "Login successful",
        hideAfter: 3,
      })
      router.push("/")
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message || "Invalid credentials")
      } else {
        setError("Unable to sign in. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <ContentWrapper className="tt-page-auth">
      <Breadcrumb />
      <div className="container-indent">
        <Container className="container-fluid-mobile">
          <Row className="justify-content-center">
            <Col md={8} lg={6}>
              <div className="tt-login-form tt-login-clean">
                <div className="tt-item">
                  <h2 className="tt-title text-center">Sign in to your account</h2>
                  <p className="text-center text-muted">
                    Access your orders, saved addresses and personalized recommendations.
                  </p>
                  <div className="form-default form-top">
                    <form onSubmit={handleSubmit} noValidate>
                      <div className="form-group">
                        <label htmlFor="loginIdentifier">E-MAIL OR PHONE *</label>
                        <input
                          type="text"
                          id="loginIdentifier"
                          name="identifier"
                          className="form-control form-control-clean"
                          placeholder="Enter email or phone number"
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="loginPassword">PASSWORD *</label>
                        <input
                          type="password"
                          id="loginPassword"
                          name="password"
                          className="form-control form-control-clean"
                          placeholder="Enter Password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>
                      {error ? <div className="tt-error-text">{error}</div> : null}
                      <Row className="tt-auth-actions with-additional">
                        <Col xs="auto" className="mr-auto">
                          <div className="form-group">
                            <button className="btn btn-border" type="submit" disabled={loading}>
                              {loading ? "Logging in..." : "LOGIN"}
                            </button>
                          </div>
                        </Col>
                        <Col xs="auto" className="align-self-center">
                          <div className="form-group">
                            <ul className="additional-links">
                              <li>
                                <Link href="/account/register" className="btn btn-border btn-small">
                                  Create account
                                </Link>
                              </li>
                              <li>
                                <Link href="/account/forgot-password">Forgot password?</Link>
                              </li>
                            </ul>
                          </div>
                        </Col>
                      </Row>
                    </form>
                  </div>
                </div>
              </div>
            </Col>
          </Row>
        </Container>
      </div>
    </ContentWrapper>
  )
}

export default LoginClient

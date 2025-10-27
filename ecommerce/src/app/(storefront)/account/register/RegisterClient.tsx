"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import cogoToast from "cogo-toast"
import { Container, Row, Col } from "react-bootstrap"
import { ContentWrapperOne as ContentWrapper } from "@components/wrapper"
import Breadcrumb from "@components/ui/breadcrumb"
import { StorefrontApi, isApiError } from "@/lib/api/storefront"
import { normalizePhoneNumber } from "@/lib/utils/phone"

const RegisterClient = () => {
  const router = useRouter()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || !phone.trim()) {
      setError("All fields are required.")
      return
    }
    setError(null)
    setLoading(true)
    try {
      const trimmedEmail = email.trim()
      const trimmedFirstName = firstName.trim()
      const trimmedLastName = lastName.trim()
      const normalizedPhone = normalizePhoneNumber(phone)
      if (!normalizedPhone) {
        setError("Please enter a valid phone number.")
        return
      }
      await StorefrontApi.register({
        email: trimmedEmail,
        password,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        phone: normalizedPhone,
      })
      cogoToast.success("Account created successfully", {
        position: "bottom-right",
        heading: "Register",
        hideAfter: 3,
      })
      router.push("/account/login")
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message || "Unable to create account")
      } else {
        setError("Unexpected error. Please try again.")
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
                  <h2 className="tt-title text-center">Create an account</h2>
                  <p className="text-center text-muted">
                    Enjoy faster checkout, order tracking, and member-only benefits.
                  </p>
                  <div className="form-default form-top">
                    <form onSubmit={handleSubmit} noValidate>
                      <div className="form-group">
                        <label htmlFor="registerFirstName">FIRST NAME *</label>
                        <input
                          type="text"
                          id="registerFirstName"
                          className="form-control form-control-clean"
                          placeholder="Enter First Name"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="registerLastName">LAST NAME *</label>
                        <input
                          type="text"
                          id="registerLastName"
                          className="form-control form-control-clean"
                          placeholder="Enter Last Name"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="registerEmail">E-MAIL *</label>
                        <input
                          type="email"
                          id="registerEmail"
                          className="form-control form-control-clean"
                          placeholder="Enter E-mail"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="registerPhone">PHONE *</label>
                        <input
                          type="tel"
                          id="registerPhone"
                          className="form-control form-control-clean"
                          placeholder="Enter Phone Number"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="registerPassword">PASSWORD *</label>
                        <input
                          type="password"
                          id="registerPassword"
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
                              {loading ? "Creating..." : "CREATE"}
                            </button>
                          </div>
                        </Col>
                        <Col xs="auto" className="align-self-center">
                          <div className="form-group">
                            <ul className="additional-links">
                              <li>
                                <Link href="/account/login">Already have an account? Sign in</Link>
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

export default RegisterClient

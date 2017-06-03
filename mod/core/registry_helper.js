/**
 * @author Pedro Sanders
 * @since v1
 */
import getConfig from 'core/config_util'

export default function RegistryHelper(sipProvider, headerFactory, messageFactory, addressFactory) {
    const LogManager = Packages.org.apache.logging.log4j.LogManager
    const LOG = LogManager.getLogger()
    const SipUtils = Packages.gov.nist.javax.sip.Utils
    const Request = Packages.javax.sip.message.Request
    const userAgent = new java.util.ArrayList()
    var config = getConfig()

    userAgent.add('Sip I/O v1.0')

    var cseq = 0

    this.requestChallenge = (username, gwRef, peerHost, transport = 'udp', expires = 300) => {
        let host = sipProvider.getListeningPoint(transport).getIPAddress()
        const port = sipProvider.getListeningPoint(transport).getPort()

        if (config.general.externalHost) {
            host = config.general.externalHost
        }

        cseq++

        const viaHeaders = []
        const viaHeader = headerFactory.createViaHeader(host, port, transport, null)
        // Request RPort for Symmetric Response Routing in accordance with RFC 3581
        viaHeader.setRPort()
        viaHeaders.push(viaHeader)

        const maxForwardsHeader = headerFactory.createMaxForwardsHeader(70)
        const callIdHeader = sipProvider.getNewCallId()
        const cSeqHeader = headerFactory.createCSeqHeader(cseq, Request.REGISTER)
        const fromAddress = addressFactory.createAddress('sip:' + username + '@' + peerHost)
        const fromHeader = headerFactory.createFromHeader(fromAddress, new SipUtils().generateTag())
        const toHeader = headerFactory.createToHeader(fromAddress, null)
        const expireHeader = headerFactory.createExpiresHeader(expires)
        const contactAddress = addressFactory.createAddress('sip:' + username + '@' + host + ':' + port)
        const contactHeader = headerFactory.createContactHeader(contactAddress)
        const userAgentHeader = headerFactory.createUserAgentHeader(userAgent)
        const gwRefHeader = headerFactory.createHeader('GwRef', gwRef)

        const request = messageFactory.createRequest('REGISTER sip:' + peerHost + ' SIP/2.0\r\n\r\n')
        request.addHeader(viaHeader)
        request.addHeader(maxForwardsHeader)
        request.addHeader(callIdHeader)
        request.addHeader(cSeqHeader)
        request.addHeader(fromHeader)
        request.addHeader(toHeader)
        request.addHeader(contactHeader)
        request.addHeader(userAgentHeader)
        request.addHeader(gwRefHeader)
        request.addHeader(headerFactory.createAllowHeader('INVITE'))
        request.addHeader(headerFactory.createAllowHeader('ACK'))
        request.addHeader(headerFactory.createAllowHeader('BYE'))
        request.addHeader(headerFactory.createAllowHeader('CANCEL'))
        request.addHeader(headerFactory.createAllowHeader('REGISTER'))
        request.addHeader(headerFactory.createAllowHeader('OPTIONS'))
        request.addHeader(expireHeader)

        try {
            const clientTransaction = sipProvider.getNewClientTransaction(request)
            clientTransaction.sendRequest()
        } catch(e) {
            if(e instanceof javax.sip.TransactionUnavailableException || e instanceof javax.sip.SipException) {
                LOG.warn('Unable to register with Gateway -> ' + peerHost + '. (Verify your network status)')
            } else {
                LOG.warn(e)
            }
        }

        LOG.debug('------->\n' + request)
    }
}